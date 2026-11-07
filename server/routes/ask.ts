import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  buildUserMessage,
  parsePickResult,
  SYSTEM_PROMPT,
} from '../../packages/core/src/pick.js'
import { db } from '../db/index.js'
import {
  faqAudio,
  faqEntries,
  offices,
} from '../db/tables/app.js'
import { pickFaq, transcribeAudio } from '../ai/cloudflare.js'
import { requireDeviceToken, type DeviceEnv } from '../middleware/device.js'

export const askRoutes = new Hono<DeviceEnv>()

askRoutes.use('/ask', requireDeviceToken)
askRoutes.use('/faq', requireDeviceToken)

type PublishedFaq = {
  id: number
  question: string
  answer: string
  updatedAt: Date
  audioUrl: string | null
  office: {
    name: string
    room: string
    hours: string
  } | null
}

async function getPublishedFaqs(): Promise<PublishedFaq[]> {
  const rows = await db
    .select({
      id: faqEntries.id,
      question: faqEntries.question,
      answer: faqEntries.answer,
      updatedAt: faqEntries.updatedAt,
      audioUrl: faqAudio.blobUrl,
      officeName: offices.name,
      officeRoom: offices.room,
      officeHours: offices.hours,
    })
    .from(faqEntries)
    .leftJoin(offices, eq(faqEntries.officeId, offices.id))
    .leftJoin(
      faqAudio,
      and(eq(faqAudio.faqId, faqEntries.id), eq(faqAudio.kind, 'answer')),
    )
    .where(eq(faqEntries.status, true))

  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    updatedAt: row.updatedAt,
    audioUrl: row.audioUrl,
    office: row.officeName && row.officeRoom && row.officeHours
      ? {
          name: row.officeName,
          room: row.officeRoom,
          hours: row.officeHours,
        }
      : null,
  }))
}

function routeResponse() {
  return {
    outcome: 'route' as const,
    text: "I couldn't find that in my published information. Please visit the appropriate university office.",
    office: null,
    audio_urls: [],
  }
}

askRoutes.post('/ask', async (c) => {
  const startedAt = Date.now()
  const audio = await c.req.arrayBuffer()

  if (audio.byteLength === 0) {
    return c.json({ error: 'Empty audio body' }, 400)
  }

  const durationMs = Number(c.req.header('x-duration-ms') ?? 0)

  if (!Number.isFinite(durationMs) || durationMs < 800) {
    return c.json(routeResponse())
  }

  try {
    const faqs = await getPublishedFaqs()

    if (faqs.length === 0) {
      return c.json({ error: 'No published FAQs available' }, 503)
    }

    const sttStartedAt = Date.now()
    const transcript = await transcribeAudio(audio)
    const sttMs = Date.now() - sttStartedAt

    if (!transcript) {
      return c.json(routeResponse())
    }

    const modelStartedAt = Date.now()
    const modelOutput = await pickFaq(
      SYSTEM_PROMPT,
      buildUserMessage(
        transcript,
        faqs.map(({ id, question }) => ({ id, question })),
      ),
    )
    const modelMs = Date.now() - modelStartedAt
    const picked = parsePickResult(
      modelOutput,
      new Set(faqs.map((faq) => faq.id)),
    )
    const selected = picked.id === null
      ? null
      : faqs.find((faq) => faq.id === picked.id)

    if (!selected) {
      return c.json({
        ...routeResponse(),
        latency_ms: {
          stt: sttMs,
          model: modelMs,
          total: Date.now() - startedAt,
        },
      })
    }

    return c.json({
      outcome: picked.confidence === 'high' ? 'answer' : 'hedged',
      text: selected.answer,
      office: selected.office,
      audio_urls: selected.audioUrl ? [selected.audioUrl] : [],
      faq_id: selected.id,
      updated_at: selected.updatedAt.toISOString().slice(0, 10),
      latency_ms: {
        stt: sttMs,
        model: modelMs,
        total: Date.now() - startedAt,
      },
    })
  } catch (error) {
    console.error('Ask pipeline failed:', error instanceof Error ? error.message : error)
    return c.json({ error: 'Ask service unavailable' }, 503)
  }
})

askRoutes.get('/faq', async (c) => {
  try {
    const faqs = await getPublishedFaqs()
    const response = {
      faqs: faqs.map((faq) => ({
        faq_id: faq.id,
        question: faq.question,
        answer: faq.answer,
        office: faq.office,
        audio_url: faq.audioUrl,
        updated_at: faq.updatedAt.toISOString().slice(0, 10),
      })),
    }

    return c.json(response, 200, {
      ETag: `"faqs-${faqs.length}-${faqs.at(-1)?.updatedAt.getTime() ?? 0}"`,
    })
  } catch (error) {
    console.error('Published FAQ lookup failed:', error instanceof Error ? error.message : error)
    return c.json({ error: 'FAQ service unavailable' }, 503)
  }
})
