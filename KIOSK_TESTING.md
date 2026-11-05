# Student kiosk integration simulator

Start the backend (`npm run dev` in be) and frontend (`npm run dev` in fe). Open http://127.0.0.1:5173/kiosk. Staff can also open it from the Test page.

This is a live database integration simulator, not a completed AI or physical kiosk. No sample answers are generated. Only published FAQ records are exposed to students. The public read-only routes are GET `/api/kiosk/questions` and POST `/api/kiosk/ask` with either `{ "faqId": 1 }` or `{ "question": "Exact FAQ wording?" }`. The response outcome is `answer` or `no_match`. Invalid requests return 400. Database failures return the existing generic 500 response. Responses are marked no-store.

The simulator allows case/whitespace/final punctuation differences but deliberately does not guess between paraphrases or ambiguous duplicate questions. Selecting a question uses its ID. Each answer request rechecks published status in the database. The question catalog refreshes when opened or when Refresh questions is clicked. Existing displayed answers are not automatically withdrawn when staff unpublishes them; clear/refresh the screen to remove previous results. Never publish confidential content: published answers and their linked office details are intentionally public.

The kiosk can open without a staff session; staff pages remain protected. Optional read-aloud uses browser speech synthesis, not server TTS. Speech recognition, ESP32 hardware, latency telemetry, production abuse controls, and AI matching are outside this simulator. Do not deploy it as the completed production question service.

## End-to-end test

1. In the staff console, create a disposable office and an unpublished FAQ linked to it.
2. Open `/kiosk` in another tab or private browser. Refresh: the unpublished question must not appear.
3. Publish the FAQ in the staff tab. Refresh kiosk questions: it must now appear.
4. Select it: verify the exact approved answer, room, building, hours and optional contact.
5. Edit the FAQ answer and office information in the staff console. Ask again: the new values must appear.
6. Type the exact published question with different case: it should match. Type an unrelated question: expect no match and no invented answer.
7. Unpublish the FAQ. Refresh the kiosk: it disappears. Asking the exact question must no longer return that answer.
8. Stop the backend. Refresh or ask: expect a connection error, never fallback sample content. Restart backend and retry.
9. Try read-aloud if the browser supports it. Stop playback and Clear screen. Keyboard and mobile layouts should remain usable.
10. Delete the disposable FAQ and office when finished.

## Verification commands

Frontend: `npm run build`.
Backend: `npm run typecheck` and `node --import tsx --test server/routes/kiosk.test.ts`.

Changes are local to both repositories. Sharing the frontend alone is insufficient: the backend needs `server/routes/kiosk.ts`, `kiosk-service.ts`, and its registration in `server/app.ts`. Coordinate those changes with the backend lead before team deployment.

## Frontend live suggestions

The kiosk now filters and ranks the published question catalog as you type. Partial words, category names, and small typos are supported. All non-stop-word search terms must match; unrelated queries show an empty state. This is lexical search, not semantic AI. Select a suggestion to retrieve its current approved answer from the backend. Enter submits a unique exact title directly; otherwise it asks you to choose a suggestion instead of guessing. The backend publication check is unchanged. Try `libra`, `libary`, and `library hours` against corresponding published FAQs. Search only covers question titles and categories, not answer text. Refresh questions after staff publishing changes.

Search logic: `src/questionSearch.ts`. Regression checks: `tests/questionSearch.test.mjs` (run with a TypeScript-capable Node loader, e.g. the sibling backend's tsx).
