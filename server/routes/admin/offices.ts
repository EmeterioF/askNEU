import { Hono } from 'hono'
import { db } from '../../db/index.js'
import { offices } from '../../db/schema/schema.js'
import { requireSession, type AuthEnv } from '../../middleware/sessionMiddleware.js'

export const adminOfficeRoutes = new Hono<AuthEnv>()

adminOfficeRoutes.get('/offices', requireSession, async (c) => {
  try {
    const officeRows = await db.select().from(offices)
    return c.json({ offices: officeRows })
  } catch (error) {
    console.error('Failed to list offices:', error)
    return c.json({ error: 'Unable to load offices' }, 500)
  }
})

adminOfficeRoutes.post('/offices', requireSession, async (c) => {
  
})