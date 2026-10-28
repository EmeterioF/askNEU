Prerequisites:

- [Vercel CLI](https://vercel.com/docs/cli) installed globally

## Layout

```
api/      Vercel entry point. Wiring only, no logic.
server/   Hono app, database, auth, AI.
src/      React staff app (not built yet).
scripts/  Dev server, seed, spike tests.
```

Imports go one way: `api/` and `scripts/` -> `server/`. `server/` never imports from them.

To develop locally:

```
npm install
npm run dev
```

```
open http://localhost:3000
```

To build locally:

```
npm install
vc build
```

To deploy:

```
npm install
vc deploy
```
