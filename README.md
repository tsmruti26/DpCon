# DpCon

DpCon is a DPDP-inspired privacy and consent platform. The React dashboard talks to a Spring Boot API; the API proxies policy analysis and public policy page extraction to a Python FastAPI service.

## Features

- Account registration and login with BCrypt passwords, JWT authentication, optional TOTP MFA, and per-user consent records.
- Consent inventory, privacy score, consent withdrawal, and account erasure that removes linked consent records.
- Versioned JSON privacy passport export/import.
- Policy text analysis and public URL discovery. Groq is optional: the AI service uses a local keyword-based fallback when no key is configured or the provider is unavailable.
- Docker Compose stack with PostgreSQL persistence for a one-command local start.
- Security controls: BCrypt cost 12, 15-minute JWTs, throttled authentication and AI calls, browser security headers, bounded AI payloads, and a private AI service authenticated with an internal token.

Automated policy analysis is an informational summary, not legal advice. The local fallback is heuristic-based and labels its source in the result.

## Run with Docker Compose

1. Copy `.env.example` to `.env` and generate unique random values for `JWT_SECRET` (at least 32 bytes), `AI_SERVICE_TOKEN` (at least 32 characters), and `POSTGRES_PASSWORD`. In PowerShell, run `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))` three times, then put a different output in each secret field. Add `GROQ_API_KEY` to enable live Groq analysis; leaving it empty uses offline analysis. `GROQ_MODEL` can select any model enabled for your Groq account.
2. Run `docker compose up --build` from the repository root.
3. Open the frontend at `http://localhost:5173`. The backend API is on port 8080; the AI service is private to the Docker network and is not published to the host.

PostgreSQL data is stored in the `postgres_data` volume. To stop the services and retain data, run `docker compose down`. Removing the volume permanently deletes the local database.

## Run locally on Windows

Run `powershell -ExecutionPolicy Bypass -File .\start-local.ps1` from the repository root. This starts the AI service on
port 8001 and the backend on port 8080 with matching local secrets saved in the Git-ignored `.local-secrets.json`.
The standalone backend uses a local H2 file database so accounts survive backend restarts; the first run after switching
from in-memory H2 requires creating the account again.
The script does not change the required-secret configuration used by Docker or production. Delete that local file only
to rotate the development secrets; doing so signs out existing browser sessions.

## Run services separately

Start the backend from the repository root:

```powershell
./mvnw spring-boot:run
```

Start the AI service from `ai-service` (Python 3.10+):

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe main.py
```

Start the frontend from `privacy-pocket` (Node.js):

```powershell
npm ci
npm run dev
```

The local backend and AI service bind to loopback by default. Before running them separately, set the same random `AI_SERVICE_TOKEN` in both environments and set a random `JWT_SECRET` of at least 32 bytes for the backend. Set `GROQ_API_KEY` in the AI service environment to enable live analysis. The AI service supports `AI_MOCK_MODE=true` to force offline mode and `AI_MOCK_MODE=false` to require a working provider. Use HTTPS through a trusted reverse proxy before exposing the app to the public internet; the included Compose setup is for local development and does not configure TLS.

## Main API routes

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/wallet/inventory`, `GET /api/wallet/score`
- `POST /api/wallet/add`, `POST /api/wallet/withdraw/{id}`
- `GET /api/wallet/passport`, `POST /api/wallet/passport`, `DELETE /api/wallet/account`
- `POST /api/ai/analyze-policy`, `POST /api/ai/analyze-url`
- AI service health is available only on the private Compose network.

The URL fetcher accepts public HTTP(S) pages only, does not follow redirects, and caps downloaded page size. Keep secrets in environment variables and restrict origins before exposing services publicly.
