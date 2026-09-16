# FixFlow

### AI-assisted maintenance ticket management

FixFlow brings maintenance reporting, staff review, technician assignment, and repair tracking into one workspace. Users report problems, admins classify and assign tickets, and technicians document the outcome. Optional Gemini integration suggests classifications and helps compare new issues with past repairs.

Built as a full-stack learning and portfolio project using **React, Spring Boot, PostgreSQL, and Python FastAPI**.

[Architecture diagrams](DIAGRAMS.md) ? [Demo walkthrough](DEMO.md) ? [Learning guide](LEARNING_GUIDE.md)

## Features

- **Role-based workspaces** for users, admins, and technicians.
- **Ticket tracking** with search, status filters, and dashboard counts.
- **Admin review and assignment** with separate original AI suggestions and staff-reviewed classifications.
- **Resolution notes** recording the cause, repair, and completion time.
- **Gemini classification** suggesting a category, priority, and summary for human review.
- **Similar past fixes** using PostgreSQL text matching, with optional Gemini relevance ranking and explanations.
- **Graceful AI fallback** so valid tickets can still be submitted when analysis fails, and text search remains available.
- **Persistent storage** for accounts, tickets, assignments, reviews, and repair notes.

## Technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | Java, Spring Boot, Spring Security, Spring JDBC |
| Database | PostgreSQL |
| AI service | Python, FastAPI, HTTPX, Google Gemini API |
| Build and verification | Maven, npm, Python unittest, Playwright, Oxlint |

Database access uses SQL through Spring JDBC's `JdbcClient`. This project does not use Hibernate, JPA, or Lombok.

## Architecture

FixFlow uses a layered client-server architecture with a separate AI service:

1. **React** sends API requests through the Vite development proxy.
2. **Spring Boot** handles authentication, authorization, validation, and ticket operations.
3. **The repository layer** executes SQL against PostgreSQL.
4. **Python FastAPI** receives optional AI requests from Spring Boot and calls Gemini.
5. Validated results return to React through the backend.

The frontend does not receive database credentials or the Gemini API key. See the [visual guide](DIAGRAMS.md) for detailed request flows.

## Roles and workflow

| Role | Permissions |
| --- | --- |
| User | Create reports and view their own tickets and outcomes |
| Admin | View all tickets, review classifications, and assign technicians |
| Technician | View assigned tickets, update their status, record repairs, and search eligible past assignments |

A typical workflow is: **report ? admin review ? assignment ? in progress ? resolved**.

Resolving requires cause and resolution notes. Technicians can reopen assigned tickets; previous notes are retained. Review and assignment are separate actions, and the workflow is not a strictly enforced sequence.

## Run locally

The commands below use **Windows PowerShell**. Start with Git, a JDK supporting Java 21, Maven, Node.js/npm, Python, and PostgreSQL installed. Development has used Node.js 24, Python 3.12, and PostgreSQL 18; the Java compilation target is 21.

### 1. Clone the repository

```powershell
git clone https://github.com/TharukiTV/FixFlow.git
cd FixFlow
```

### 2. Create the database

Create a PostgreSQL database named `fixflow`, using pgAdmin or SQL:

```sql
CREATE DATABASE fixflow;
```

If it already exists, use the existing database. Spring Boot initializes the schema on startup. The default connection is `localhost:5432`, database `fixflow`, username `postgres`.

### 3. Start the Java backend

In a terminal at the repository root:

```powershell
cd fixflow-backend
.\start.ps1
```

Enter the PostgreSQL password at the masked prompt. Wait for `Started FixFlowApplication`. The backend listens at **http://127.0.0.1:8080**.

### 4. Start the React frontend

In a second terminal at the repository root:

```powershell
cd fixflow-frontend
npm.cmd ci --cache ../.npm-cache
npm.cmd run dev
```

Open **http://127.0.0.1:5173** to use FixFlow.

### 5. Start the optional AI service

In a third terminal at the repository root:

```powershell
cd fixflow-ai-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\start.ps1
```

Enter a Gemini API key at the masked prompt. The service listens at **http://127.0.0.1:8000**; its interactive API documentation is at `/docs`.

Keep each service terminal open. Do not start a second copy on the same port. If AI is unavailable, ticket submission may wait for the bounded analysis request before saving without a suggestion. Restarting Spring Boot clears login sessions but preserves database records.

### 6. Set up role accounts

Register accounts through the frontend. Every new account starts with the USER role. To promote existing accounts, run these commands in `fixflow-backend`, replacing the example emails:

```powershell
.\set-role.ps1 -Email 'admin@example.com' -Role ADMIN
.\set-role.ps1 -Email 'tech@example.com' -Role TECHNICIAN
```

The role script expects PostgreSQL 18 at its standard Windows installation path; adjust `psqlPath` in the script if installed elsewhere. It prompts for the PostgreSQL password. `UPDATE 1` means an account was updated. Refresh the frontend after changing roles. See the [learning guide](LEARNING_GUIDE.md) for the pgAdmin alternative and setup troubleshooting.

## Configuration

Set environment variables in the terminal that starts the relevant service. The startup scripts prompt for secrets; the app does not automatically load a `.env` file.

| Variable | Service | Purpose |
| --- | --- | --- |
| `DB_URL` | Spring Boot | PostgreSQL JDBC URL; defaults to `jdbc:postgresql://localhost:5432/fixflow` |
| `DB_USERNAME` | Spring Boot | Database user; defaults to `postgres` |
| `DB_PASSWORD` | Spring Boot | Database password supplied by the startup prompt |
| `AI_SERVICE_URL` | Spring Boot | Python address; defaults to `http://127.0.0.1:8000` |
| `GEMINI_API_KEY` | Python | Gemini credential supplied by the startup prompt |
| `GEMINI_MODEL` | Python | Model override; choose one available to your API project |
| `AI_MODE` | Python | Defaults to `gemini`; `demo` produces labelled sample classifications and disables Gemini ranking |

Never commit real passwords or API keys. Local dependencies, database files, environment files, and build output are excluded by `.gitignore`.

## How the AI features work

**Classification:** Gemini suggests a category, priority, and summary. Successful previews are cached in the login session for ten minutes. Submitting unchanged text during that window reuses the preview. Admin review is stored separately from the original suggestion.

**Past-fix comparison:** PostgreSQL supplies up to five text matches and twenty recent resolved tickets assigned to the technician. After deduplication, Gemini ranks up to five relevant candidates and explains the similarities. Returned IDs and explanations are validated; displayed repair notes come from the database. Access is checked again after the provider request.

This is a bounded candidate search, not a semantic search of every historical ticket. Similarity does not prove the same cause. Comparison results are not saved.

AI requests send report content, and for comparisons the candidate repair notes, to Google and may consume API quota. Temporary failures have capped retries within a twenty-second provider budget. Quota exhaustion, outages, or invalid responses produce errors or labelled text fallback rather than fabricated AI results.

## Project structure

```text
FixFlow/
|-- fixflow-frontend/      React UI, API client, browser tests
|-- fixflow-backend/       Java controllers, security, SQL repository
|-- fixflow-ai-service/    FastAPI endpoints, Gemini adapter, Python tests
|-- README.md             Project overview and local setup
|-- DIAGRAMS.md           Architecture and workflow diagrams
|-- DEMO.md               Presentation walkthrough
|-- LEARNING_GUIDE.md     Detailed lessons and troubleshooting
```

## Verification

Frontend checks, run inside `fixflow-frontend`:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e
```

The Playwright configuration uses Microsoft Edge. Browser tests use mocked API responses.

Python checks, run inside `fixflow-ai-service`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Python tests simulate Gemini responses without consuming quota. Backend smoke scripts under `fixflow-backend/tests` require the separately configured test backend and PostgreSQL cluster described in the [learning guide](LEARNING_GUIDE.md). Do not run data-creating smoke tests against your main database.

## Scope and future work

FixFlow is a local portfolio application, not a production deployment. It uses session authentication, bcrypt password hashing, CSRF protection, and backend access checks. Password reset, email verification, login rate limiting, notifications, and a complete ticket audit history are not implemented.

Potential next steps include a full activity history, deployment hardening, and an explicitly permissioned shared repair knowledge base. Current technician searches remain limited to their assigned records.
