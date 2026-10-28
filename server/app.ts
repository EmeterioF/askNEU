import { Hono } from 'hono'
import { adminOfficeRoutes } from './routes/admin/offices.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'

const app = new Hono()

app.route('/api', healthRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/admin', adminOfficeRoutes)

export default app