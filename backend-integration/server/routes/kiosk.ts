import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { faqEntries, offices } from '../db/tables/app.js'
import { selectQuestion } from './kiosk-service.js'

export const kioskRoutes = new Hono()
const askInput = z.union([
  z.object({ faqId: z.number().int().positive() }).strict(),
  z.object({ question: z.string().trim().min(1).max(255) }).strict(),
])

// Public student-facing routes: only explicitly published FAQs are exposed.
kioskRoutes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  await next()
})
kioskRoutes.get('/questions', async c => {
  const questions = await db.select({ id: faqEntries.id, question: faqEntries.question, category: faqEntries.category })
    .from(faqEntries).where(eq(faqEntries.status, true)).orderBy(faqEntries.id)
  return c.json({ questions, mode: 'exact-match-simulator' })
})
kioskRoutes.post('/ask', async c => {
  const input = askInput.safeParse(await c.req.json().catch(() => null))
  if (!input.success) return c.json({ error: 'Select a question or enter a question of 1–255 characters.' }, 400)
  const data = input.data
  const rows = await db.select({
    id: faqEntries.id, question: faqEntries.question, answer: faqEntries.answer,
    category: faqEntries.category, updatedAt: faqEntries.updatedAt,
    office: { id: offices.id, name: offices.name, room: offices.room, building: offices.building, hours: offices.hours, contact: offices.contact },
  }).from(faqEntries).leftJoin(offices, eq(faqEntries.officeId, offices.id))
    .where('faqId' in data ? and(eq(faqEntries.status, true), eq(faqEntries.id, data.faqId)) : eq(faqEntries.status, true))
  const faq = 'faqId' in data ? rows[0] : selectQuestion(rows, data.question)
  if (!faq) return c.json({ outcome: 'no_match', message: 'No unique published answer was found. Choose an available question or ask a staff member.', mode: 'exact-match-simulator' })
  return c.json({ outcome: 'answer', faq, mode: 'exact-match-simulator' })
})
