# Controlled Drug Logbook

Digital controlled-drug logbook prototype for hospital and private clinical areas.

The app keeps the drug-card/register workflow while adding:

- device setup for one iPad/computer per clinical area
- hospital and location setup
- controlled-drug stock cards
- patient administration register
- two-person verification
- pharmacy requests and pharmacy supply
- stock checks and corrections
- location-specific patient lists

## Run Locally

Start the backend:

```bash
cd server
npm install
npm start
```

Start the frontend in another terminal:

```bash
cd client
npm install
npm run dev
```

Open the frontend URL shown by Vite, usually:

```text
http://localhost:5173
```

The backend defaults to:

```text
http://localhost:8000
```

## Backend Environment

Copy the example environment file:

```bash
cd server
cp .env.example .env
```

Set these values before production use:

```text
PORT=8000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret
DEFAULT_ADMIN_PASSWORD=change-this-admin-password
```

If no environment is set during local development, the backend uses development fallbacks and prints a warning.

## Important Notes

This is still a prototype. Real clinical use needs governance, information security review, backup policy, audit review, and local controlled-drug process approval.

The SQLite database is stored in:

```text
server/druglog.db
```

Back it up before major changes.

## Current Development Focus

- Keep the original drug-card style and register workflow.
- Make every iPad/computer locked to one clinical area.
- Keep separate stock and patient lists per location.
- Continue cleaning routing and moving configuration out of source code.
