# AskNEU frontend handoff

## What has been built

This repository contains the temporary staff web frontend for AskNEU. It is a React web application, not React Native. The UI is an integration prototype and is not a final Figma-approved design.

Implemented: login, session restoration, logout, protected navigation, office and FAQ lists, create/edit forms, publish/unpublish, search/category/status filtering, delete confirmation, loading/empty/error/success states, and responsive layouts. AI question matching and physical kiosk integration are not implemented.

TypeScript checking and a production build passed during initial development. Authenticated CRUD has NOT been verified end to end because the backend environment/database credentials and test staff account are still required. A page rendering successfully does not prove backend integration works.

## Files and where to edit

### src/App.tsx — screens and behavior

- `App`: checks `/auth/get-session` on startup and sets up routing.
- `Login`: email/password form, password visibility, login errors, and sign-in request.
- `Shell`: shared sidebar, navigation, staff identity, protected routes, and logout.
- `Management`: shared FAQ/office screen, list requests, local filtering, create/edit forms, publishing, and deletion. Its `kind` prop chooses FAQs versus offices.
- `Modal`: shared native HTML dialog, Escape behavior, focus restoration, and close controls.
- `Alert`: success/error messages.
Change screen text, form fields, table columns, navigation, dialog contents, or CRUD behavior here. When adding a backend field, update its model in `api.ts`, form controls, save payload, and displayed values together. If this file grows, split screens/components into separate files while preserving behavior.

### src/api.ts — backend connection, models, and session

Defines the `Office`, `FAQ`, and `User` TypeScript models; one shared Axios client; Zustand session state; unauthorized-session handling; and readable error messages.

All request paths use the shared client's `/api` base URL and cookies. Example: `api.get('/admin/faqs')` calls `/api/admin/faqs`. Do not add a second `/api` prefix. Update models here if backend response fields change. Keep passwords and database credentials out of Zustand and frontend source. Zustand currently holds session/UI identity; fetched records remain in page state.

### src/styles.css — appearance and responsive layouts

Contains Tailwind import and shared CSS. Edit colors, fonts, spacing, buttons, tables, dialogs, login layout, sidebar, and breakpoints here. Desktop sidebar becomes compact navigation on smaller screens. Preserve visible focus indicators, contrast, readable labels, and accessible dialogs when restyling.

### src/main.tsx — application entry

Mounts React, loads styles, and wraps the application with BrowserRouter. Usually edit only when adding global providers.

### vite.config.ts — local development connection

Configures React/Tailwind, frontend port 5173, and `/api` proxy to `http://localhost:3000`. If the backend port changes, change the target and the development Origin/Referer rewrite together. Port 5173 is strict: stop an existing frontend process before starting another.

The Origin/Referer rewrite is for this local setup only. Production needs an agreed UI/API origin, cookie configuration, trusted origins, and SPA route fallback. Vite's development proxy is not included in the built static files.

### index.html — browser document

Edit the browser tab title, metadata, and eventual favicon here. React renders inside `#root`.

### package.json — commands and dependencies

`npm run dev` starts Vite, `npm run typecheck` checks TypeScript, `npm run build` checks TypeScript and creates `dist`, and `npm run preview` previews the static production output. Preview does not automatically provide the backend proxy.

### package-lock.json — reproducible dependencies

Commit this file. Use `npm ci` after cloning. Do not hand-edit it; npm updates it when dependencies change.

### tsconfig.json — TypeScript rules

Defines strict checking, browser libraries, JSX, and module handling. Change only when a feature needs a deliberate compiler configuration change.

### .gitignore — local-only files

Excludes installed dependencies, generated build output, logs, and environment files. Keep secrets out of Git. `node_modules` is recreated with npm; `dist` is recreated with the build command.

### README.md and TEAM_GUIDE.md — setup and handoff

Update these when startup steps, endpoint contracts, known limitations, or team workflow changes.

## API contract used by the frontend

- POST `/api/auth/sign-in/email`: `{ email, password }`; expects a user on success.
- GET `/api/auth/get-session`: restores the current user/session.
- POST `/api/auth/sign-out`: ends the session.
- GET `/api/admin/faqs`: expects `{ faqs: [...] }`.
- POST `/api/admin/faqs`: creates an FAQ; expects `{ faq: ... }`.
- PATCH `/api/admin/faqs/:id`: updates an FAQ; expects `{ faq: ... }`.
- DELETE `/api/admin/faqs/:id`: succeeds with 204 and no JSON body.
- GET `/api/admin/offices`: expects `{ offices: [...] }`.
- POST `/api/admin/offices`: creates an office; expects `{ office: ... }`.
- PATCH `/api/admin/offices/:id`: updates an office; expects `{ office: ... }`.
- DELETE `/api/admin/offices/:id`: succeeds with 204 and no JSON body.

FAQ payload fields: `question`, `answer`, `category`, numeric `officeId` or null, and boolean `status`. True displays Published; false displays Unpublished. Office payload fields: `name`, `room`, `building`, `hours`, and optional `contact` (null when empty). IDs are numeric and updated timestamps are formatted for the viewer's locale. FAQ question maximum is 255 characters, category 100; office name/hours/contact 255 and room/building 100, matching the current validators.

## Backend coordination still needed

1. Backend developer provides development database/auth configuration locally and a test staff account.
2. Confirm session cookies and Better Auth endpoints work through the local proxy.
3. Verify all CRUD responses and error shapes with the actual database.
4. Backend should return a helpful conflict error when an office is referenced by FAQs. It currently may return generic 500; the UI adds a conditional hint.
5. Backend team should confirm signup restrictions and staff authorization. A protected screen in React is not a substitute for server authorization.
6. Agree on the final Figma designs and deployment configuration.

## Classmate workflow

Clone this repository, run `npm ci`, then `npm run dev`. Start the separately maintained backend on port 3000 in another terminal. This frontend needs no `.env` for the default local setup; secrets belong in the backend environment.

Create a feature branch such as `feat/faq-layout` from updated `main`. Keep changes focused, run `npm run typecheck` and `npm run build`, then open a pull request into this repository's `main`. The original backend repository uses `dev`; that is a separate repository and workflow.

Manual integration checklist: sign in, create a disposable office, create an unpublished FAQ linked to it, edit the FAQ, publish/unpublish, test search/filters, reload to restore session, cancel a delete, test linked-office deletion, delete the FAQ, delete the office, sign out, and verify protected routes redirect. Stop the backend to test connection errors. Also check keyboard navigation, dialog focus, and narrow screens. Do not use real staff content as disposable test data.
