# Backend companion files

These files accompany the student kiosk frontend. They are not a standalone backend.

Use the existing EmeterioF/askNEU backend on its dev branch. Copy the three files from this folder's server/routes directory into the backend's server/routes directory, reviewing any existing versions before replacing them.

In the backend's server/app.ts, add:

```ts
import { kioskRoutes } from './routes/kiosk.js'
```

Before `export default app`, register:

```ts
app.route('/api/kiosk', kioskRoutes)
```

Run `npm run typecheck` and `node --import tsx --test server/routes/kiosk.test.ts` from the backend, then restart its development server. No database migration or new dependency is required. Configure database/auth credentials privately in the backend as usual.

The routes intentionally expose only published FAQs and their linked office details to students without a staff session. The backend rechecks published status on every answer request. They implement exact matching or selection by FAQ ID, not semantic AI. Frontend fuzzy suggestions select IDs and still retrieve answers from this backend. Review KIOSK_TESTING.md in the repository root for the integration checklist and limitations. Coordinate these additions with the backend lead before deployment.