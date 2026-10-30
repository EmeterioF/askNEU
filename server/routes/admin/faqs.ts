import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { faqEntries } from '../../db/tables/app.js'
import { requireSession, type AuthEnv } from '../../middleware/session.js'

export const createFaqInput = z.object({
  question: z.string().trim().min(1).max(255),
  answer: z.string().trim().min(1),
  category: z.string().trim().min(1).max(100),
  officeId: z.number().int().positive().nullish(),
  status: z.boolean().optional(),
})

export const updateFaqInput = createFaqInput
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export const adminFaqsRoutes = new Hono<AuthEnv>()

adminFaqsRoutes.use('*', requireSession)

adminFaqsRoutes.get('/faqs', async (c) => {
  const faqs = await db.select().from(faqEntries)
  return c.json({ faqs })
})

adminFaqsRoutes.post('/faqs', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createFaqInput.safeParse(body)

  if (!parsed.success) {
    return c.json(
      { error: 'Invalid FAQ data', issues: z.treeifyError(parsed.error) },
      400,
    )
  }

  const [faq] = await db.insert(faqEntries).values(parsed.data).returning()

  return c.json({ faq }, 201)
})

adminFaqsRoutes.patch('/faqs/:id', async (c) => {
  const id = Number(c.req.param('id'))

  if (!Number.isInteger(id) || id < 1) {
    return c.json({ error: 'Invalid FAQ id' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = updateFaqInput.safeParse(body)

  if (!parsed.success) {
    return c.json(
      { error: 'Invalid FAQ data', issues: z.treeifyError(parsed.error) },
      400,
    )
  }

  const [faq] = await db
    .update(faqEntries)
    .set(parsed.data)
    .where(eq(faqEntries.id, id))
    .returning()

  if (!faq) {
    return c.json({ error: 'FAQ not found' }, 404)
  }

  return c.json({ faq })
})

adminFaqsRoutes.delete('/faqs/:id', async (c) => {
  const id = Number(c.req.param('id'))

  if (!Number.isInteger(id) || id < 1) {
    return c.json({ error: 'Invalid FAQ id' }, 400)
  }

  const [faq] = await db
    .delete(faqEntries)
    .where(eq(faqEntries.id, id))
    .returning({ id: faqEntries.id })

  if (!faq) {
    return c.json({ error: 'FAQ not found' }, 404)
  }

  return c.body(null, 204)
})
