import app from '../server/app.js'

// Vercel recognises a default export that exposes fetch(Request) -> Response as
// a Web handler. Hono's app has exactly that, so no adapter is needed.
export default app
