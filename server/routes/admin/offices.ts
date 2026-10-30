import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
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

export const updateOfficeInput = createOfficeInput
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
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

adminOfficeRoutes.patch('/offices/:id', async (c) => {
  const id = Number(c.req.param('id'))

  if (!Number.isInteger(id) || id < 1) {
    return c.json({ error: 'Invalid office id' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = updateOfficeInput.safeParse(body)

  if (!parsed.success) {
    return c.json(
      { error: 'Invalid office data', issues: z.treeifyError(parsed.error) },
      400,
    )
  }

  const [office] = await db
    .update(offices)
    .set(parsed.data)
    .where(eq(offices.id, id))
    .returning()

  if (!office) {
    return c.json({ error: 'Office not found' }, 404)
  }

  return c.json({ office })
})

adminOfficeRoutes.delete('/offices/:id', async (c) => {
  const id = Number(c.req.param('id'))

  if (!Number.isInteger(id) || id < 1) {
    return c.json({ error: 'Invalid office id' }, 400)
  }

  const [office] = await db
    .delete(offices)
    .where(eq(offices.id, id))
    .returning({ id: offices.id })

  if (!office) {
    return c.json({ error: 'Office not found' }, 404)
  }

  return c.body(null, 204)
})
