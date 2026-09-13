# FixFlow presentation and demo

## Your opening explanation

“FixFlow is a maintenance ticket application. A user reports a problem, an admin reviews and assigns it, and a technician records the repair. Gemini can suggest a category and priority, but a staff member reviews the suggestion. The system also helps technicians find similar repairs in their past assigned tickets.”

## Before presenting

- Start the services using the [README](README.md#start-on-this-computer) and open http://127.0.0.1:5173.
- Have a registered user, an admin, and a technician account ready. Registrations create users; the local role setup command promotes existing accounts.
- Prepare a resolved ticket assigned to your demo technician: “Projector has no signal”, cause “Loose HDMI cable”, resolution “Reconnected the cable and verified the picture.” Use these as fictional demo notes only.
- Have an open projector ticket ready if you want to avoid waiting for an AI request during the presentation.
- Use separate browser profiles/private windows or sign out between roles. Tabs in the same browser profile share the login session.
- Keep terminal password/key prompts out of the presentation. Never show an API key.

## Five-minute walkthrough

### 1. Report an issue — about one minute

Sign in as the regular user. Enter “Projector shows no signal when connected to a laptop” and location “Lab 2”.

If Gemini is available, click **Analyze with Gemini** once. Explain that the category, priority, and summary are suggestions. Submit unchanged text within ten minutes to reuse that preview. If quota is exhausted, continue with **Submit issue**; the request may wait before saving without AI. Alternatively, use your prepared open ticket.

Say: “The report is saved in PostgreSQL and gets a ticket number. The user can track it after refreshing or signing in again.”

### 2. Review and assign — about one minute

Sign in as Admin and refresh the list. Find the ticket, expand **Confirm or correct classification**, enter or confirm the category, priority, and summary, and click **Save review**. Assign it to the demo technician.

Say: “The admin makes the final classification decision. The original AI suggestion and the staff review are stored separately. When AI is unavailable, the admin can classify the issue manually.”

### 3. Find a past fix — about one minute

Sign in as the assigned technician. On the new projector ticket, click **Find similar past fixes** and expand the prepared resolved match.

Say: “This search uses PostgreSQL English text matching. It shows up to five resolved tickets assigned to this technician, including the recorded cause and repair. It does not call Gemini. Similar words do not prove the same fault.”

If no match appears, check that the old ticket is **Resolved**, has both cause and resolution notes, shares meaningful words in its description, and is currently assigned to this technician.

### 4. Record the repair — about one minute

Set the new ticket to **In progress** and click **Save status**. Then select **Resolved**, enter the cause and resolution for your fictional demonstration, and save again.

Say: “Only the assigned technician can update the status. Resolving requires both notes, and the backend records the completion time.”

### 5. Show the result — about one minute

Sign back in as the reporter and refresh. Show **Resolved** and the saved notes.

Say: “The reporter can see the outcome without editing staff decisions. The backend enforces permissions, even if someone tries to call an API directly.”

## Explain the technology in simple words

| Technology | How to explain its job |
| --- | --- |
| React and TypeScript | React displays the page and updates it when data changes. TypeScript checks the shapes of frontend data during development. |
| Spring Boot | Runs the Java server and exposes endpoints for login, tickets, assignments, and reviews. |
| Maven | Downloads Java dependencies and compiles and runs the backend using the configuration in `pom.xml`. |
| PostgreSQL | Stores records so they remain after a server restart. |
| Spring JDBC | Executes SQL with bound parameters through the repository. This project uses direct SQL, not Spring Data JPA. |
| FastAPI and Python | Provide the optional analysis service and validate incoming reports and model output. |
| Gemini | Produces a suggested category, priority, and summary from the report. FixFlow does not train its own model. |

## Code you can show

- [IncidentController.java](fixflow-backend/src/main/java/com/fixflow/incident/IncidentController.java): maps HTTP requests to actions and checks roles.
- [IncidentRepository.java](fixflow-backend/src/main/java/com/fixflow/incident/IncidentRepository.java): reads and writes tickets using SQL, and searches past fixes.
- [CreateIncidentRequest.java](fixflow-backend/src/main/java/com/fixflow/incident/CreateIncidentRequest.java): declares and validates report input.
- [App.tsx](fixflow-frontend/src/App.tsx): displays the dashboard and ticket forms.
- [SimilarFixes.tsx](fixflow-frontend/src/SimilarFixes.tsx): loads and displays past repair records.
- [gemini.py](fixflow-ai-service/app/gemini.py): calls Gemini, validates output, and handles temporary failures.

For one example, explain: “Submitting a report sends an HTTP request from React to the controller. The backend checks the request, attempts optional analysis, and calls the repository. The repository inserts the ticket into PostgreSQL and returns it so React can display it.”

## Questions you may be asked

**What happens when Gemini fails?** The ticket can still be saved without a suggestion and reviewed manually. Temporary failures have capped retries within a twenty-second provider budget. Retries cannot bypass quota limits.

**Is the similar-fixes feature AI?** No. It matches English word stems in descriptions using PostgreSQL. It does not understand meaning like a language model or search all technicians' records.

**How are passwords handled?** Account passwords are hashed with bcrypt. Login uses a server session with an HttpOnly cookie, and write requests use CSRF protection. The frontend does not contain the database password or Gemini key.

**What are the limitations?** This is a local learning application. It has no password reset, email verification, or login rate limiting. Reviews and resolution notes keep the latest values rather than a full audit history. Gemini availability depends on the provider and quota. It has not been prepared for public deployment.

**What could come next?** A complete ticket activity history, notifications, or a deliberately designed shared repair knowledge base with appropriate access controls. Describe these as future work, not existing features.

## What has been checked

The latest similar-fixes change passed backend compilation, frontend build and lint, a browser test using mock responses, and PostgreSQL query checks using temporary test records. The browser test covers results, an empty search, and retrying after an error. SQL checks cover matching and assignment boundaries. These checks do not establish live Gemini availability or replace a complete production security review.

The README lists additional existing test scripts for authentication, roles, analysis, and reviews. State which checks you actually ran when presenting your own results.
