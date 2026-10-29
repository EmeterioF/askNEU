import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { offices } from '../../db/tables/app.js'
import { requireSession, type AuthEnv } from '../../middleware/session.js'

export const createOfficeInput = z.object({
  name: z.string().trim().min(1).max(255),
  room: z.string().trim().min(1).max(100),
  building: z.string().trim().min(1).max(100),
  hours: z.string().trim().min(1).max(255),
  contact: z.string().trim().max(255).nullish().transform((v) => v || null),
})

export const adminOfficeRoutes = new Hono<AuthEnv>()

adminOfficeRoutes.use('*', requireSession)

adminOfficeRoutes.get('/offices', async (c) => {
  const officeRows = await db.select().from(offices)

  return c.json({ offices: officeRows })
})

adminOfficeRoutes.post('/offices', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createOfficeInput.safeParse(body)

  if (!parsed.success) {
    return c.json(
      { error: 'Invalid office data', issues: z.treeifyError(parsed.error) },
      400,
    )
  }

  const [office] = await db.insert(offices).values(parsed.data).returning()

  return c.json({ office }, 201)
})

