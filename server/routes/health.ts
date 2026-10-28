import { Hono } from 'hono'
import { sql } from '../db/index.js'

export const healthRoutes = new Hono()

healthRoutes.get('/health', (c) => {
  return c.json({ ok: true })
})

healthRoutes.get('/health/db', async (c) => {
  try {
    await sql`SELECT 1`

    return c.json({
      ok: true,
      database: 'ok',
    })
  } catch (error) {
    console.error('Database health check failed:', error)

    return c.json(
      {
        ok: false,
        database: 'error',
      },
      503,
    )
  }
})
