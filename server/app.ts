import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { adminOfficeRoutes } from './routes/admin/offices.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'

const app = new Hono()

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }

  console.error(`${c.req.method} ${c.req.path} failed:`, err)
  return c.json({ error: 'Internal server error' }, 500)
})

app.route('/api', healthRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/admin', adminOfficeRoutes)

export default app