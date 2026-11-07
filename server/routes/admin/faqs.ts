import { Hono } from 'hono'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { put } from '@vercel/blob'
import { db } from '../../db/index.js'
import { faqAudio, faqEntries } from '../../db/tables/app.js'
import { synthesizeSpeech } from '../../ai/cloudflare.js'
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
  const rows = await db
    .select({ faq: faqEntries, audioUrl: faqAudio.blobUrl })
    .from(faqEntries)
    .leftJoin(
      faqAudio,
      and(eq(faqAudio.faqId, faqEntries.id), eq(faqAudio.kind, 'answer')),
    )

  const faqs = rows.map(({ faq, audioUrl }) => ({ ...faq, audioUrl }))

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

async function generateFaqAudio(id: number) {
  const [faq] = await db
    .select()
    .from(faqEntries)
    .where(eq(faqEntries.id, id))

  if (!faq) {
    return null
  }

  const audio = await synthesizeSpeech(faq.answer)
  const textHash = createHash('sha256').update(faq.answer).digest('hex')
  const blob = await put(`faq/${faq.id}/${textHash}.mp3`, audio, {
    access: 'public',
    contentType: 'audio/mpeg',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 31536000,
  })

  await db
    .insert(faqAudio)
    .values({
      faqId: faq.id,
      kind: 'answer',
      blobUrl: blob.url,
      textHash,
      voice: 'aura-2-en-luna',
    })
    .onConflictDoUpdate({
      target: [faqAudio.faqId, faqAudio.kind],
      set: {
        blobUrl: blob.url,
        textHash,
        voice: 'aura-2-en-luna',
        generatedAt: new Date(),
      },
    })

  return faq
}

async function publishFaq(id: number) {
  const faq = await generateFaqAudio(id)

  if (!faq) {
    return null
  }

  const [publishedFaq] = await db
    .update(faqEntries)
    .set({ status: true })
    .where(eq(faqEntries.id, id))
    .returning()

  return publishedFaq
}

adminFaqsRoutes.post('/faqs/:id/publish', async (c) => {
  const id = Number(c.req.param('id'))

  if (!Number.isInteger(id) || id < 1) {
    return c.json({ error: 'Invalid FAQ id' }, 400)
  }

  try {
    const faq = await publishFaq(id)

    if (!faq) {
      return c.json({ error: 'FAQ not found' }, 404)
    }

    const [audio] = await db
      .select({ audioUrl: faqAudio.blobUrl })
      .from(faqAudio)
      .where(eq(faqAudio.faqId, faq.id))

    return c.json({ faq: { ...faq, audioUrl: audio?.audioUrl ?? null } }, 200)
  } catch (error) {
    console.error(
      'FAQ publish failed:',
      error instanceof Error ? error.message : error,
    )
    return c.json({ error: 'FAQ audio generation failed' }, 503)
  }
})

adminFaqsRoutes.post('/faqs/:id/audio', async (c) => {
  const id = Number(c.req.param('id'))

  if (!Number.isInteger(id) || id < 1) {
    return c.json({ error: 'Invalid FAQ id' }, 400)
  }

  try {
    const faq = await publishFaq(id)

    if (!faq) {
      return c.json({ error: 'FAQ not found' }, 404)
    }

    const [audio] = await db
      .select({ audioUrl: faqAudio.blobUrl })
      .from(faqAudio)
      .where(eq(faqAudio.faqId, faq.id))

    return c.json({ faq: { ...faq, audioUrl: audio?.audioUrl ?? null } }, 200)
  } catch (error) {
    console.error(
      'FAQ audio regeneration failed:',
      error instanceof Error ? error.message : error,
    )
    return c.json({ error: 'FAQ audio generation failed' }, 503)
  }
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
