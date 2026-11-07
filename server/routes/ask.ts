import { Hono } from 'hono'
import { requireDeviceToken, type DeviceEnv } from '../middleware/device.js'

export const askRoutes = new Hono<DeviceEnv>()

// Scoped to the kiosk endpoints only. A wildcard here is mounted as /api/* and
// would also guard unrelated routes such as the mock audio clips.
askRoutes.use('/ask', requireDeviceToken)
askRoutes.use('/faq', requireDeviceToken)

// Placeholder answer until the STT + matcher pipeline exists. The response shape
// is already the final one from the architecture contract, so the firmware never
// has to change when the real handler lands.
const MOCK_ANSWER = {
  outcome: 'answer' as const,
  text: 'Enrollment runs June 1 to 15 at the Registrar, room 204.',
  office: {
    name: 'Registrar',
    room: '204',
    hours: '8:00-17:00',
  },
  faq_id: 1,
  updated_at: '2026-11-07',
}

askRoutes.post('/ask', async (c) => {
  const audio = await c.req.arrayBuffer()

  if (audio.byteLength === 0) {
    return c.json({ error: 'Empty audio body' }, 400)
  }

  const durationMs = Number(c.req.header('x-duration-ms') ?? 0)
  const origin = new URL(c.req.url).origin

  return c.json({
    ...MOCK_ANSWER,
    // The real backend returns MeloTTS MP3, so the mock does the same: it keeps
    // the device's decode path honest during development.
    audio_urls: [`${origin}/api/mock/audio/answer.mp3`],
    latency_ms: {
      stt: 0,
      model: 0,
      total: Number.isFinite(durationMs) ? durationMs : 0,
    },
  })
})

// The BUSY-screen browse list. Mock data for now, same shape as the real one.
askRoutes.get('/faq', (c) => {
  const faqs = [
    {
      faq_id: 1,
      question: 'When is enrollment?',
      answer: MOCK_ANSWER.text,
      office: MOCK_ANSWER.office,
      audio_url: new URL('/api/mock/audio/answer.mp3', c.req.url).toString(),
      updated_at: MOCK_ANSWER.updated_at,
    },
  ]

  return c.json({ faqs }, 200, {
    ETag: `"mock-${MOCK_ANSWER.updated_at}"`,
  })
})
