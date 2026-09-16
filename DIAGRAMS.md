# FixFlow: visual learning guide

Read these diagrams in order. Rectangles are actions, diamonds are decisions, and arrows show where data or control goes. These diagrams describe the current local application. Code names in parentheses connect the diagrams to Java methods.

## 1. The complete system

```mermaid
flowchart TD
    person["User, admin, or technician"] --> browser["React frontend - port 5173"]
    browser -->|"HTTP requests through Vite proxy"| security["Spring Security - login session and CSRF checks"]
    security --> controller["Spring Boot controllers - port 8080"]
    controller --> accounts["AccountService - current account and role"]
    accounts <--> database[("PostgreSQL - accounts and tickets")]
    controller --> repository["IncidentRepository - SQL queries"]
    repository <--> database
    controller --> analysis["AnalysisController - optional AI requests"]
    analysis --> python["Python FastAPI - port 8000"]
    python --> gemini["Google Gemini - external service"]
    gemini --> python
    python --> analysis
    analysis --> controller
    repository --> controller
    controller -->|"JSON response"| browser
```

React draws the screen. Spring Boot decides which actions are allowed. PostgreSQL stores records. Python communicates with Gemini. The browser never connects directly to PostgreSQL or receives the Gemini API key.

## 2. Registration, login, and access

```mermaid
flowchart TD
    start["Open FixFlow"] --> account{"Already registered?"}
    account -->|"No"| register["Enter name, email, and password"]
    register --> validate["Backend validates registration"]
    validate --> hash["Hash password and save account with USER role"]
    hash --> login["Enter email and password to sign in"]
    account -->|"Yes"| login
    login --> check{"Credentials accepted?"}
    check -->|"No"| denied["401 - login failed"]
    check -->|"Yes"| session["Create authenticated server session and cookie"]
    session --> dashboard["React loads account profile and accessible tickets"]
    dashboard --> request["Send ticket request with session cookie"]
    request --> guard["Spring Security checks authentication; writes also require CSRF token"]
    guard --> role["Controller checks current role when action requires one"]
    role --> scope["Repository restricts records by ownership or assignment"]
    scope --> response["Return permitted data or an error"]
```

New registrations are always USER accounts. An existing account is promoted locally using the role setup command. `Principal` identifies the signed-in account; `HttpSession` holds session data such as successful AI previews.

## 3. The normal ticket journey

```mermaid
flowchart TD
    report["USER describes a problem and location"] --> optional["Optionally preview Gemini analysis"]
    optional --> submit["Submit issue"]
    submit --> open["Save ticket with status OPEN"]
    open --> review["ADMIN confirms or corrects category, priority, and summary"]
    review --> assign["ADMIN assigns a technician"]
    assign --> work["Assigned TECHNICIAN saves IN_PROGRESS"]
    work --> search["Optionally inspect similar past fixes"]
    search --> repair["Technician investigates and performs the actual repair"]
    repair --> notes["Enter cause and resolution notes"]
    notes --> resolved["Save RESOLVED and completion time"]
    resolved --> track["Reporter and admin can read the outcome"]
    resolved --> reopen["Assigned technician can reopen the ticket"]
    reopen --> work
```

This is the usual workflow, not a strictly enforced order: an admin can assign before reviewing, and a technician can resolve directly from OPEN with valid notes. Reopening preserves previous resolution notes. Only the assigned technician can change status.

## 4. Creating a ticket: inside create()

```mermaid
flowchart TD
    click["React submits description and location"] --> post["POST /api/incidents"]
    post --> security["Check session and CSRF token"]
    security --> input["Validate CreateIncidentRequest"]
    input --> role{"Account has USER role?"}
    role -->|"No"| forbidden["403 Forbidden"]
    role -->|"Yes"| cache{"Same text has a successful session preview under 10 minutes old?"}
    cache -->|"Yes"| reuse["Reuse trusted preview without another Gemini request"]
    cache -->|"No"| ai["Request optional analysis through Python"]
    ai --> valid{"Analysis succeeds and is valid?"}
    valid -->|"Yes"| suggestion["Use category, priority, summary, and provider mode"]
    valid -->|"No"| empty["Continue with no AI suggestion"]
    reuse --> save["IncidentRepository.create saves ticket in PostgreSQL"]
    suggestion --> save
    empty --> save
    save --> created["201 Created - ticket JSON and ticket URL"]
    created --> display["React displays the new ticket"]
```

Invalid report fields return 400. The owner comes from the login identity, not a browser-supplied email. AI failure does not prevent saving a valid ticket; database failures can still prevent saving it.

## 5. What happens inside an AI analysis request

```mermaid
flowchart TD
    preview["Analyze with Gemini button"] --> java["POST /api/analysis in Spring Boot"]
    java --> py["POST /ai/analyze-incident in Python"]
    py --> config{"Gemini mode and key configured?"}
    config -->|"No"| unavailable["Return error; explicit demo mode has labelled sample output"]
    config -->|"Yes"| google["Send report with instructions and JSON schema to Google"]
    google --> success{"Provider request successful?"}
    success -->|"No"| retry["Retry eligible temporary failures within shared 20-second budget"]
    retry --> exhausted["If attempts fail, return a safe error code"]
    success -->|"Yes"| schema["Validate complete response, category, priority, and summary"]
    schema --> result["Return validated suggestion to Spring Boot"]
    result --> cache["Validate and cache successful preview in this login session"]
    cache --> screen["Show suggestion for staff review"]
    exhausted --> message["React shows failure; user can still submit ticket"]
    unavailable --> message
```

There are at most three provider attempts, not unlimited retries. A retry that succeeds continues through response validation. Invalid output is rejected. A successful preview alone does not create a database ticket; submission saves it with the ticket.

## 6. Reading, assigning, reviewing, and resolving

```mermaid
flowchart TD
    request["Request reaches IncidentController"] --> action{"Which operation?"}
    action -->|"list or get"| read["Pass login identity and current role to repository"]
    read --> visibility["USER: owned tickets; TECHNICIAN: assigned tickets; ADMIN: all tickets"]
    action -->|"technicians"| choices["Require ADMIN and return technician profiles"]
    action -->|"assign"| assign["Require ADMIN and validate technician email"]
    assign --> assignment["Repository checks target is a registered technician and saves assignment"]
    action -->|"review"| review["Require ADMIN and validate category, priority, and summary"]
    review --> reviewed["Save reviewed fields, reviewer, and time; preserve original AI fields"]
    action -->|"updateStatus"| status["Require TECHNICIAN and validate requested status"]
    status --> notes{"Requested status is RESOLVED?"}
    notes -->|"Yes"| required["Require nonblank cause and resolution"]
    notes -->|"No"| preserve["Preserve previous resolution notes"]
    required --> update["Update only if ticket is assigned to this technician"]
    preserve --> update
    visibility --> response["Return accessible records or operation result"]
    choices --> response
    assignment --> response
    reviewed --> response
    update --> response
```

`@PathVariable` reads the ticket ID from the URL. `@RequestBody` turns JSON into a Java object. `@Valid` runs input constraints. `orElseThrow` returns an HTTP error when a repository result is absent. Role failures return 403; inaccessible single-ticket reads return 404; invalid assignments return 400.

## 7. Text search versus Gemini comparison

```mermaid
flowchart TD
    tech["Technician opens an assigned ticket"] --> choice{"Which button?"}
    choice -->|"Find similar past fixes"| textGet["GET similar-fixes endpoint"]
    textGet --> textAuth["Check technician role and source ticket access"]
    textAuth --> sql["PostgreSQL compares English word stems in descriptions"]
    sql --> textList["Return up to 5 matching resolved assignments with both notes"]
    choice -->|"Compare with Gemini"| aiPost["POST similar-fixes endpoint with CSRF token"]
    aiPost --> aiAuth["Check technician role and source ticket access"]
    aiAuth --> candidates["Combine top 5 text matches and 20 recent resolved assignments; remove duplicates"]
    candidates --> any{"Any candidates?"}
    any -->|"No"| noRecords["Return empty result without calling Gemini"]
    any -->|"Yes"| fallback["Keep text matches ready as fallback"]
    fallback --> python["Send source description and candidate descriptions and repair notes to Python"]
    python --> gemini["Gemini compares meaning and returns IDs plus explanations"]
    gemini --> validate{"Response valid?"}
    validate -->|"Yes"| ranked["At most 5 supplied IDs; no duplicates; valid explanations"]
    validate -->|"No or provider failure"| fail["Use text matches and show specific failure reason"]
    ranked --> access["Recheck role, source access, candidate assignment, status, and content"]
    fail --> access
    access --> output["Return only still-accessible unchanged results"]
    output --> ui["React shows mode, notice, original notes, and optional AI explanation"]
    textList --> ui
    noRecords --> ui
```

Gemini does not search all historical tickets: it ranks a bounded set of up to 25 candidates. Only this technician's assigned records are considered. Unknown or repeated IDs are rejected in Python and Java. The displayed repair notes always come from PostgreSQL; AI explanations are suggestions, not proof that the cause is identical. Comparison results are not saved.

## 8. Connect the diagrams to the code

| Code | Purpose |
| --- | --- |
| `SecurityConfig.java` | Session authentication, CSRF, login, and logout |
| `AccountService.java` | Account profiles, password handling, and roles |
| `IncidentController.java` | Routes ticket requests, checks roles, coordinates operations |
| `IncidentRepository.java` | SQL, record visibility, ticket changes, and text search |
| `Incident.java` | Ticket data returned to React |
| `CreateIncidentRequest.java` | Input fields and validation for a new report |
| `AnalysisController.java` | Calls Python and caches successful analysis previews |
| `app/main.py` | Python endpoints and input/output models |
| `app/gemini.py` | Gemini request, response validation, retries, and safe errors |
| `src/api.ts` | Frontend HTTP requests and TypeScript data types |
| `src/App.tsx` | Dashboard, report form, and ticket cards |
| `src/SimilarFixes.tsx` | Text search and Gemini comparison controls |

For practice, trace one projector ticket through diagrams 3, 4, 6, and 7. For every arrow, ask: who sends this, which method receives it, and is anything saved to the database?
