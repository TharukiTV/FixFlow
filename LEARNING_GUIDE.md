# FixFlow ? maintenance ticket management

FixFlow helps users report maintenance issues, admins review and assign them, and technicians record completed repairs. Optional Gemini analysis suggests a category, priority, and summary for human review. Technicians can also search their assigned resolved tickets for similar past fixes without calling Gemini.

Start with the [presentation and demo guide](DEMO.md) for a five-minute walkthrough and beginner-friendly explanations. The sections below document setup and the project's learning progression; later lessons build on earlier ones.

## Current architecture

| Part | Responsibility | Local port |
| --- | --- | --- |
| React + TypeScript (Vite) | Forms, login, ticket dashboard, and role-specific controls | 5173 |
| Java + Spring Boot | Authentication, permissions, validation, ticket APIs, and database queries   | 8080 |
| PostgreSQL | Accounts, tickets, assignments, suggestions, reviews, and resolution notes | 5432 |
| Python + FastAPI | Calls Gemini and validates its structured response | 8000 |

The browser calls Spring Boot through Vite's `/api` proxy. Spring Boot reads and writes PostgreSQL and calls Python for optional analysis. Python calls Google Gemini. Similar past fixes are PostgreSQL text matches, not AI-generated answers.

## Start on this computer

Open three terminals from the project root, one per service. Keep each terminal open:

```powershell
# Terminal 1: enter the PostgreSQL password when prompted
cd fixflow-backend
.\start.ps1
```

```powershell
# Terminal 2
cd fixflow-frontend
npm.cmd run dev
```

```powershell
# Terminal 3: enter the Gemini API key when prompted
cd fixflow-ai-service
.\start.ps1
```

Open http://127.0.0.1:5173. Python is optional for the manual ticket workflow; unavailable analysis can delay submission before the ticket is saved without a suggestion. Do not start a second copy of a running service. Backend restarts require signing in again; PostgreSQL retains saved records.

These commands assume dependencies and the database have been set up on this computer. See the setup sections below for installation and account roles. Keep passwords and API keys out of source files and screenshots.

## Set up the database

PostgreSQL 18 is already installed and running on this computer.
Open pgAdmin and connect to the local server using your PostgreSQL password.
Right-click Databases, select Create > Database, and name it `fixflow`.
If it already exists, use it without recreating it. Do not delete existing databases.
The app creates its `incidents` table on startup without dropping existing data.
Tickets from the earlier memory-only version are not migrated.

## Run

Stop the previous backend with Ctrl+C. In PowerShell from the project folder:

```powershell
cd fixflow-backend
.\start.ps1
```

Enter your PostgreSQL password at the hidden prompt. Do not put it in source files or chat.
The script supplies it through an environment variable and restores the old value when the backend stops.
Wait for `Started FixFlowApplication`, then open http://localhost:8080.
Keep the terminal open while using the app. Ctrl+C stops it.

If PowerShell blocks scripts, run these commands directly from fixflow-backend:

```powershell
$securePassword = Read-Host 'PostgreSQL password' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
mvn "-Dmaven.repo.local=../.maven" spring-boot:run
Remove-Item Env:DB_PASSWORD
```

Defaults: database `fixflow`, user `postgres`, host `localhost`, port `5432`.
For a different account or connection, set `DB_USERNAME` and `DB_URL` in the terminal before starting.
The URL format is `jdbc:postgresql://localhost:5432/fixflow`.
Password authentication failed means credentials were rejected. Database does not exist means you need to create `fixflow`. Connection refused usually means the service is stopped or the port is incorrect.

## Try persistence

1. Create a ticket for Projector not working, location Lab 2.
2. Choose In progress and click Save status.
3. Stop and restart the backend.
4. Refresh the page. The ticket and its status should remain.
5. In pgAdmin's Query Tool for fixflow, run `SELECT * FROM incidents;`.

## Understand the code

Browser -> controller -> repository -> PostgreSQL -> response -> browser.

- `pom.xml`: Maven dependencies, now including Spring JDBC and the PostgreSQL driver.
- `FixFlowApplication.java`: starts the application and web server.
- `Incident.java`: a Java record holding ticket data.
- `CreateIncidentRequest.java`: validates descriptions and locations.
- `IncidentStatus.java`: enum defining OPEN, IN_PROGRESS, and RESOLVED.
- `UpdateIncidentStatusRequest.java`: validates status input.
- `IncidentController.java`: handles HTTP requests. Spring supplies its repository through the constructor.
- `IncidentRepository.java`: executes SQL. SELECT reads rows; INSERT creates one; UPDATE changes status. Bound parameters keep user input separate from SQL.
- `schema.sql`: defines the table. PostgreSQL generates IDs and timestamps. CREATE TABLE IF NOT EXISTS preserves an existing table but does not migrate later schema changes.
- `application.properties`: connection settings, with the password supplied through the environment.
- `static/index.html`: browser form, ticket list, and status controls.

Java sources are under `fixflow-backend/src/main/java/com/fixflow`. SQL, properties, and the page are under `fixflow-backend/src/main/resources`.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/incidents` | List tickets, newest first |
| GET | `/api/incidents/1` | Read one ticket |
| POST | `/api/incidents` | Create using description and location |
| PATCH | `/api/incidents/1/status` | Update using `{"status":"IN_PROGRESS"}` |

Missing tickets return 404. Invalid input returns 400. Select Open to reopen a ticket.
This is a local learning app. Users report and read their own tickets. Technicians update assigned tickets. Admins assign tickets.

## Learning progression

Lesson 1 introduced records, controllers, GET/POST, and memory storage.
Lesson 2 introduced enums and PATCH status updates.
Lesson 3 replaces the memory map with a SQL repository. Follow `create` from the controller into the repository to understand how a ticket is saved.
We use direct SQL to learn database operations; Spring Data JPA can be introduced later.

References: [Spring JDBC](https://docs.spring.io/spring-framework/reference/6.2/data-access/jdbc/core.html), [database initialization](https://docs.spring.io/spring-boot/how-to/data-initialization.html).

## Lesson 4: React frontend

Keep Spring Boot running on port 8080 in its own terminal. Open a second terminal from the project root:

```powershell
cd fixflow-frontend
npm.cmd install --cache ../.npm-cache
npm.cmd run dev
```

Open http://localhost:5173 for the new React dashboard. Port 8080 shows a link to the React app; use port 5173 to sign in.
Use `npm.cmd` on Windows to avoid PowerShell script policy errors.
React displays real tickets from your backend, supports search and status filters, creates reports, and updates statuses.

- `src/App.tsx`: dashboard state, ReportIssueForm, and TicketCard components. State stores values that make React redraw the page when they change.
- `src/api.ts`: TypeScript ticket types and GET/POST/PATCH requests using fetch.
- `src/index.css`: responsive styling.
- `src/main.tsx`: mounts React into the root element in index.html.
- `vite.config.ts`: forwards /api requests to Spring Boot on port 8080 during development and local preview.

The frontend has no database password. Only Spring Boot connects to PostgreSQL.
Run `npm.cmd run build` to check TypeScript and create dist, and `npm.cmd run lint` for code checks.
For deployment, serve dist behind a server that forwards /api to Spring Boot; the Vite development proxy is not included in the built files.

Reference: [Vite server proxy](https://vite.dev/config/server-options).

## Lesson 5: user accounts

Restart the backend with Ctrl+C followed by `.\start.ps1` in fixflow-backend. Keep the React development server running and refresh http://127.0.0.1:5173.

1. Select **New here? Create an account** and enter your name, email, and a password of at least 8 characters (maximum 72 UTF-8 bytes).
2. After registration, sign in with that email and password.
3. Create a ticket. Your account sees only tickets it owns.
4. Sign out, register another account, and sign in. The first account's tickets should be absent.
5. Sign back into your first account: its tickets remain.

Your website account password is separate from the PostgreSQL password used in the terminal.
Old practice tickets remain in PostgreSQL with no owner. Users cannot see them; admins can see and assign them.
Lesson 6 replaces owner status updates with technician permissions: users track progress; only the assigned technician changes status.

### How login works

- `auth/AccountService.java` stores account records and hashes passwords with bcrypt. Plain passwords are not saved.
- `auth/SecurityConfig.java` requires authentication for ticket endpoints. Spring Security handles login, session rotation, and logout.
- `auth/AuthController.java` handles registration, current-user lookup, and CSRF tokens.
- `IncidentRepository.java` includes the signed-in user's email in every ticket query. The owner comes from the backend login session, not browser input.
- `src/Auth.tsx` shows registration/login and clears the dashboard on logout or session expiration.
- `src/api.ts` gets a CSRF token before writes. This protects cookie-authenticated requests from being submitted by another website.

Login uses an HttpOnly session cookie, not a token stored in localStorage. Sessions expire after 30 minutes of inactivity and are cleared when the backend restarts. Accounts and tickets remain in PostgreSQL.
The schema update adds app_users, a nullable owner_email foreign key, and an index without dropping existing records. CREATE TABLE/ADD COLUMN IF NOT EXISTS support this learning migration; future complex migrations should use a migration tool.

Use HTTPS and secure cookies before public deployment. Password reset, email verification, and login rate limiting are not part of this local lesson.

### Verification

`npm.cmd run test:e2e` in fixflow-frontend runs browser flows using mock responses (requires Microsoft Edge). `npm.cmd run build` and `npm.cmd run lint` check the frontend.
`python tests/auth_smoke.py http://127.0.0.1:8081` in fixflow-backend checks real authentication and ticket ownership against a separately configured test backend/database. It creates test accounts and a ticket, so use an isolated test database.

References: [Spring Security sessions](https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html), [CSRF protection](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html).

## Lesson 6: roles and technician assignment

Restart the backend with Ctrl+C and `.\start.ps1` to add the role and assignment columns. Refresh the frontend.

| Role | See tickets | Create reports | Assign technicians | Update status |
| --- | --- | --- | --- | --- |
| USER | Own tickets | Yes | No | No |
| TECHNICIAN | Assigned tickets | No | No | Assigned tickets only |
| ADMIN | All tickets, including old unowned reports | No | Yes | No |

All registrations create USER accounts. There is no public role-selection or promotion API.

### Set up your demo accounts

1. Register three separate accounts through the website: one regular user, one admin, and one technician.
2. In a new PowerShell terminal in `fixflow-backend`, promote the existing accounts. Replace the example emails with the emails you registered:

```powershell
.\set-role.ps1 -Email 'admin@example.com' -Role ADMIN
.\set-role.ps1 -Email 'tech@example.com' -Role TECHNICIAN
```

The hidden password prompt here asks for your PostgreSQL password. `UPDATE 1` confirms success; `UPDATE 0` means that email was not found. The command runs parameterized psql variables through scripts/set-role.sql and never creates an account or changes its password.
If script execution is blocked, use pgAdmin's Query Tool on fixflow instead, substituting your registered email:

```sql
UPDATE app_users SET role = 'ADMIN' WHERE email = 'admin@example.com';
UPDATE app_users SET role = 'TECHNICIAN' WHERE email = 'tech@example.com';
```

Refresh the page after changing roles. The backend reads the current database role on each protected action, so permissions change even for an existing session. Refresh reloads the frontend controls.
Use a normal browser and a private window to test separate accounts at the same time.

### Try the workflow

1. As USER, create an issue.
2. As ADMIN, find the ticket, choose a technician, and click **Assign ticket**.
3. As that TECHNICIAN, refresh the list, select **In progress**, and save the status. Later mark it Resolved.
4. As USER, refresh and see the updated status and assignment. No status editor is shown.
5. As ADMIN, you can reassign a ticket. The previous technician immediately loses access; status is preserved.

Admins can assign old practice tickets that have no owner. Promoting an account does not transfer ownership of its previously reported tickets. Admins can still view those tickets. Demoting a technician leaves assignment history in place but removes their ability to update; an admin can reassign the ticket.

### New code

- `AccountService.Profile` includes role. Registration relies on the database USER default.
- `IncidentController.requireRole` enforces each operation using the current database role.
- `IncidentRepository` filters by owner for users, assignee for technicians, and permits all rows for admins. Status updates include the technician email in the SQL WHERE clause.
- `PATCH /api/incidents/{id}/assignment` accepts `{"technicianEmail":"tech@example.com"}` and requires ADMIN. Only registered TECHNICIAN accounts can be assigned.
- `GET /api/incidents/technicians` lists technician choices for ADMIN only.
- `AssignmentForm.tsx` provides the admin assignment controls. App.tsx switches the dashboard controls according to role.

New schema columns use additive migrations; existing accounts default to USER and existing tickets start unassigned. No data is dropped.

### Tests

`python tests/roles_smoke.py http://127.0.0.1:8081` runs against the isolated test backend on 8081 and PostgreSQL test cluster on 55432. It creates test accounts, promotes them using the same SQL setup script, and verifies denied operations, assignment, updates, reassignment, and immediate demotion. Do not point it at your main database.
`npm.cmd run test:e2e` includes USER, ADMIN, and TECHNICIAN browser flows with mock responses.

## Lesson 7: your first Python service

The optional **Preview sample analysis** button now connects React -> Spring Boot -> FastAPI.
It uses keyword examples, not a real AI model. There are no API keys or model charges. Sample priority is not a safety assessment. Preview results are not saved or used to assign tickets.

### Start the three services

Keep each service in its own terminal:

| Service | Folder | Command | Address |
| --- | --- | --- | --- |
| Spring Boot | fixflow-backend | `.\start.ps1` | localhost:8080 |
| React | fixflow-frontend | `npm.cmd run dev` | 127.0.0.1:5173 |
| FastAPI | fixflow-ai-service | `.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000` | 127.0.0.1:8000 |

The Python environment is already installed on this computer. Restart Spring Boot after this code change, then refresh React.
If Python is already running, do not start a second copy on port 8000. Ctrl+C stops a service in its terminal.

For a new checkout, run inside fixflow-ai-service:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

This virtual environment keeps Python libraries separate from other projects; no activation script is needed.
For tests, install requirements-dev.txt instead. requirements-lock.txt records the complete tested dependency versions.

### Try it

Sign in as a User and enter `Wi-Fi is not working` with location `Lab 2`. Click **Preview sample analysis**. You should see a clearly labelled IT sample. You can submit the ticket with or without a preview.
Edit the input after previewing: the previous result disappears so it cannot be mistaken for a result for your new text.
If FastAPI is stopped, the preview shows an error but ticket creation still works.

Open http://127.0.0.1:8000/docs to try the Python endpoint directly. Expand POST /ai/analyze-incident, click Try it out, and submit:

```json
{"description":"Wi-Fi is not working","location":"Lab 2"}
```

### Read the Python code

Open `fixflow-ai-service/app/main.py`:

- `app = FastAPI(...)` creates the application, similar to starting your Spring application.
- `IncidentInput` defines the expected fields. Pydantic rejects blank or oversized values.
- `@app.post(...)` connects a URL to a Python function, similar to Spring's @PostMapping.
- `def analyze_incident(...)` defines the function. Python uses indentation to group code instead of Java's braces.
- `return Analysis(...)` becomes the JSON response. The response model restricts the output fields and values.
- Keyword matching is only a teaching example. It cannot understand negation, risk, or context. A real model is a later lesson.

`AnalysisController.java` in the backend sends the request with a 2-second connection timeout and, in the current version, a 25-second read timeout. The authenticated endpoint is POST /api/analysis and retains CSRF protection. In the current version, ticket creation attempts optional analysis but still saves the ticket if analysis fails.
Set AI_SERVICE_URL in the backend environment to change the Python address. The Python service listens only on the local computer and has no database credentials or ticket-writing tools.

### Verify

Inside fixflow-ai-service: `.\.venv\Scripts\python.exe -m unittest discover -s tests -v`.
Inside fixflow-frontend: `npm.cmd run test:e2e -- tests/analysis.spec.ts`.
The backend tests/analysis_smoke.py script checks the full connection against an isolated test backend and creates a temporary test account there.

References: [FastAPI first steps](https://fastapi.tiangolo.com/tutorial/first-steps/), [request models](https://fastapi.tiangolo.com/tutorial/body/).

## Lesson 8: Gemini AI

Gemini is now the default analysis provider. There is no silent demo fallback: missing keys and provider errors return an unavailable response, while ticket submission remains independent.

### Configure your API key locally

1. Stop the existing Python service on port 8000 (Ctrl+C in its terminal).
2. In a terminal inside `fixflow-ai-service`, run `.\start.ps1`.
3. Paste your Gemini API key into the masked prompt and press Enter. Do not paste it in chat, React code, or committed files.
4. Restart Spring Boot and refresh the frontend. As a User, enter an issue and click **Analyze with Gemini**.

If PowerShell blocks scripts, use these commands inside fixflow-ai-service:

```powershell
$secureKey = Read-Host 'Gemini API key' -AsSecureString
$env:GEMINI_API_KEY = [System.Net.NetworkCredential]::new('', $secureKey).Password
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
Remove-Item Env:GEMINI_API_KEY
```

The API key is passed through the Python process environment and sent to Google in a request header, not the URL. No key is stored in the project. The startup script restores the previous environment value when it exits.
Clicking Analyze sends the issue description and location to Google Gemini and may consume your account quota. Results are suggestions for staff review, not automatic assignments. Submission can save the suggestion with the ticket as described below.

### Model and errors

The default model is `gemini-3.8-flash`. To use another model available to your key, set `$env:GEMINI_MODEL = 'your-model-id'` before starting Python.
Python allows up to 20 seconds for the provider request; Spring waits 25 seconds and React waits 30 seconds for analysis. Temporary failures are retried within the existing total time limit; see the retry section below.
Missing or rejected keys, unavailable models, quota limits, and timeouts are reported as unavailable. Invalid or blocked outputs are rejected. No provider error body or API key is returned to the browser.
The local health endpoint shows mode and whether a key is configured, but does not verify the key against Google.

For offline teaching only, set `$env:AI_MODE = 'demo'` before starting Python. Results will be labelled **Demo sample (not AI)**. Remove that setting with `Remove-Item Env:AI_MODE` to return to Gemini mode.

### Code and checks

`app/gemini.py` calls Google's generateContent REST endpoint using httpx. It requests JSON constrained by the Suggestion Pydantic schema and validates the returned category, priority, and summary. Report text is treated as data, not instructions. Mode and review notice are supplied by our code.
`app/main.py` chooses Gemini or explicit demo mode. `AnalysisPreview.tsx` displays the provider label and clears results when the input changes.
Run `.\.venv\Scripts\python.exe -m unittest discover -s tests -v` for isolated tests with mocked Gemini responses. These do not use your key or consume quota. A real provider call still needs local key configuration.

Reference: [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en).

## Lesson 9: saved AI suggestions and admin review

Restart Spring Boot (`Ctrl+C`, then `.\start.ps1`) to add the new nullable database columns. Keep Python/Gemini and React running, then refresh the browser.

1. As a USER, create a report. Submission reuses a matching successful preview from the current session (up to ten minutes old), or requests analysis from Python, and stores the validated category, priority, summary, and provider mode with the new ticket.
2. The ticket card shows **Awaiting admin review** and the original Gemini suggestion (or a clearly labelled demo result).
3. As ADMIN, expand **Confirm or correct classification**, change or confirm the category, priority, and summary, then click **Save review**.
4. The reviewed result is shown to the reporter and assigned technician. The original AI result remains available in its own expandable section.
5. Refresh or restart the backend: PostgreSQL retains both the original suggestion and the review.

The Analyze button previews a suggestion. Submitting unchanged text within ten minutes reuses the successful server-side preview in the same login session. Without a matching preview, submission requests analysis. Reports are sent to Google through the Python service.
If analysis fails, is invalid, or times out, the ticket is still created with no AI suggestion. An admin can classify it manually. Existing tickets also start without AI fields; no automatic backfill or provider calls are made for them.

The original fields (`ai_mode`, `ai_category`, `ai_priority`, `ai_summary`) and reviewed fields (`reviewed_category`, `reviewed_priority`, `reviewed_summary`, `reviewed_by`, `reviewed_at`) are stored separately. The review records the latest reviewer and timestamp, not a complete history of edits.

`PATCH /api/incidents/{id}/review` requires ADMIN and accepts:

```json
{"category":"IT","priority":"HIGH","summary":"Network outage confirmed by staff."}
```

The backend restricts category and priority to known enum values and rejects blank or oversized summaries. Browser-provided AI fields are not trusted: ticket creation obtains its own analysis from Python. Existing ownership and technician assignment checks still apply to viewing the result.

`TicketAnalysis.tsx` renders the suggestion and review form. `ReviewRequest.java` validates reviews. `IncidentRepository.java` stores both versions. Ticket submission allows up to 40 seconds in the browser to accommodate the backend's bounded analysis request. The button stays disabled during submission.

Verification: `tests/review_smoke.py` checks real persistence, review permissions, preserved original fields, forged browser fields, and unavailable/invalid provider responses against the isolated database. Its local FastAPI fixture is `tests/analysis_fixture.py` on 8001 (run using the AI service virtualenv); the test backend must use AI_SERVICE_URL=http://127.0.0.1:8001 and port 8081. No Gemini key is used for these tests. Browser tests are in tests/review.spec.ts and tests/analysis.spec.ts.

## Fix: preserve successful previews on submission

Spring Boot now retains up to eight successful previews in your login session for ten minutes. Submitting the same description and location (ignoring surrounding whitespace) reuses that trusted server result, without a second Gemini request. Edited input, an expired preview, logout, or a backend restart requires fresh analysis. Cached results never cross login sessions and browser-supplied analysis fields are still ignored.
Restart Spring Boot to activate this fix. Existing tickets with missing analysis are unchanged; admins can classify them manually. For a new ticket, analyze, submit unchanged text within ten minutes, and refresh the admin list.
This replaces Lesson 9's earlier statement that every submission always calls Gemini again.

## Lesson 10: technician resolution notes

Restart Spring Boot and refresh React. The schema adds nullable cause, resolution, and resolved_at fields without changing existing tickets.

1. As the assigned TECHNICIAN, choose **Resolved** on a ticket.
2. Enter **Cause** (up to 1,000 characters; use Unknown if not established) and **Resolution** (up to 2,000 characters: what was done and how it was checked).
3. Click **Save status**. The server records the resolved date automatically with the status and notes in one database update.
4. The reporter and admin can read the notes on the ticket card. They cannot edit them.

Resolving requires both nonblank notes, enforced by the backend as well as the form. Only the currently assigned technician can update them. A technician can correct notes on an already resolved ticket without changing its original resolved date.
Reopening preserves the notes and date under **Previous resolution (ticket reopened)**. Resolving again records a new date and replaces the previous notes. This is the latest resolution, not a full history of resolutions.
Older resolved tickets have no fabricated date or notes. Their assigned technician can add notes and save to record a completion date now.

Example PATCH /api/incidents/1/status:

```json
{"status":"RESOLVED","cause":"Faulty HDMI adapter","resolution":"Replaced adapter and tested the projector."}
```

OPEN and IN_PROGRESS updates still accept status alone and preserve any prior notes.
`UpdateIncidentStatusRequest.java` validates the fields and conditional requirement; `IncidentRepository.updateStatus` saves the notes and timestamp atomically. The React TicketCard shows inputs only when the technician selects Resolved.

Verification covers missing/blank/oversized notes, assignment permissions, reporter/admin read access, edits to existing resolutions, reopening, and a new resolved date on subsequent resolution. Run the isolated roles_smoke.py test and browser tests/roles.spec.ts as described above.

## Gemini temporary-failure retries

Restart the Python service to activate this change. A request now makes at most three attempts for HTTP 429, 500, 502, 503, 504, network failures, and timeouts. Backoff delays start at approximately 1 and 2 seconds, with a small random variation. Retry-After is respected when it fits the time budget; otherwise the error returns without another attempt.
All attempts and delays share the existing 20-second limit. Invalid keys, unavailable models, other permanent errors, and invalid model output are not retried. A successful response returns immediately. There is no model switching. Retried requests may use provider quota; no retry creates a ticket by itself. Long outages still show an error, and ticket submission retains its manual-review fallback.
The Python terminal logs retry numbers and delays, without API keys or report content. Tests in tests/test_retries.py simulate recovery, retry exhaustion, Retry-After, network errors, and the total deadline without calling Gemini.

## Lesson 11: similar past fixes

Restart Spring Boot, refresh the frontend, and sign in as a technician. On a ticket, click **Find similar past fixes**. Expand a result to read its recorded cause and resolution.

The search returns up to five resolved tickets currently assigned to the same technician, excluding the current ticket and records without both notes. This preserves the existing assignment permissions; it is not a shared organization-wide knowledge base. If an admin assigns your sample resolved tickets to a different technician, those samples will not appear for you.

PostgreSQL English full-text matching compares descriptions, ignores common stopwords, and matches word stems. Results rank by text match, then most recent resolution and ID. Matching words do not establish the same cause; a technician must review each record. There are no Gemini calls or quota costs. Queries run when the button is clicked; click again to refresh results.

`GET /api/incidents/{id}/similar-fixes` requires TECHNICIAN and access to the source ticket. It returns only ID, description, cause, and resolution. Regular users and admins cannot call this endpoint. No schema change is needed.

Checks: frontend build/lint and `npm.cmd run test:e2e -- tests/similar-fixes.spec.ts`. With the isolated PostgreSQL cluster running on 55432, `python fixflow-backend/tests/similar_fixes_sql.py` verifies matching, stopwords, excluded records, and assignment boundaries using temporary tables rolled back at completion.

## Gemini comparison of past fixes

Restart Spring Boot and Python, then refresh React. Technicians can use **Compare with Gemini** next to the existing text search button. This sends the current description and up to 25 authorized past records (the top five text matches plus 20 recent resolved assignments, deduplicated) to Google, including descriptions and cause/resolution notes. It consumes Gemini quota only when requested; no matches means no provider call.

Gemini returns up to five IDs with explanations; both Python and Java validate IDs and reject duplicates. Displayed repair notes come from PostgreSQL, never generated text. No ranking is saved. If Gemini fails, the response is explicitly labelled as text matches. A successful empty AI result is shown as no matches. This bounded candidate search does not search the meaning of every historical ticket. English text search remains independently available.

The POST `/api/incidents/{id}/similar-fixes` endpoint requires a technician session and CSRF token. Source and candidate tickets must be assigned to that technician; access is checked again after the provider call. Python uses the existing retry and timeout limits. No public shared repair library is introduced.

## Visual learning guide

See [DIAGRAMS.md](DIAGRAMS.md) for the system architecture and step-by-step flows for login, ticket creation, admin review, technician resolution, and Gemini comparison.

