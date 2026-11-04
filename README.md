# AskNEU staff frontend

Temporary staff web interface for testing AskNEU's existing authentication, FAQ management, and office management APIs. Built with React, Vite, TypeScript, Axios, Zustand, React Router, and Tailwind CSS.

**Status:** frontend implemented; initial type check and production build passed. End-to-end login and CRUD testing are pending the backend environment configuration and a test staff account. This is not the final Figma-approved UI.

## Get started

Use Node.js 22 or another version supported by the installed dependencies.

```powershell
git clone https://github.com/N4theee/IOT_ASKNEU.git
cd IOT_ASKNEU
npm ci
npm run dev
```

Open http://127.0.0.1:5173. If port 5173 is occupied, stop the previous frontend terminal with Ctrl+C.

## Start the backend separately

Backend source: https://github.com/EmeterioF/askNEU (branch `dev`). This repository contains the frontend only and does not copy the backend or its credentials.

```powershell
git clone --branch dev https://github.com/EmeterioF/askNEU.git askneu-backend
cd askneu-backend
npm ci --include=dev
# Configure .env locally using .env.example and values from the backend developer.
npm run dev
```

The backend must run at http://localhost:3000. A development staff account must already exist. Ask the backend developer for account provisioning; there is no registration screen or fake login in this frontend.

The frontend uses relative `/api` URLs and sends cookies. Vite proxies these requests to port 3000 and rewrites the local development Origin/Referer for Better Auth. No frontend `.env` is needed for this default setup. Never put database credentials or auth secrets in frontend source or `VITE_` variables.

Without backend configuration, the frontend can run but will show a connection error during session checks. Use **Go to sign in** to inspect the login screen. Protected management screens require a real authenticated backend session.

## Included

- Login, session restoration, logout, and protected navigation.
- Office list, create/edit forms, and confirmed deletion.
- FAQ list, local search/category/status filters, create/edit, publish/unpublish, and confirmed deletion.
- Loading, empty, success, validation, unauthorized, and server-error handling.
- Responsive desktop/mobile styling and native dialogs.
- Test placeholder only; student kiosk and AI question flow are not implemented.

## Validation

```powershell
npm run typecheck
npm run build
```

`npm run preview` previews the generated static build, but does not supply the development API proxy. Production hosting must configure API routing, cookies/trusted origins, and browser route fallback.

## Team handoff

Read [TEAM_GUIDE.md](TEAM_GUIDE.md) for every file's purpose, what to edit, API payloads, known limitations, and a manual integration checklist.

Installed packages (`node_modules`), generated files (`dist`), and private environment files are intentionally excluded. Classmates recreate dependencies with `npm ci`.
