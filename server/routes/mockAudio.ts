import { readFile } from 'node:fs/promises'
import { Hono } from 'hono'

// Dev-only stand-in for Cloudflare Blob audio. Files are served by explicit
// allow-list so nothing outside fixtures/audio can be read. The clips are
// committed so a fresh clone can demo the voice loop without regenerating TTS.
const SAMPLE_CLIPS: Record<string, { path: URL; type: string }> = {
  // Same sentence as the WAV, encoded as MP3 like the real backend returns, so
  // the dev loop exercises the device's MP3 decode path.
  'answer.mp3': {
    path: new URL('../fixtures/audio/answer.mp3', import.meta.url),
    type: 'audio/mpeg',
  },
  // Full sentence matching the mock answer text, so the kiosk reads the whole
  // answer instead of a fragment.
  'answer.wav': {
    path: new URL('../fixtures/audio/answer.wav', import.meta.url),
    type: 'audio/wav',
  },
  'melotts-sample.wav': {
    path: new URL('../fixtures/audio/melotts-sample.wav', import.meta.url),
    type: 'audio/wav',
  },
}

export const mockAudioRoutes = new Hono()

mockAudioRoutes.get('/mock/audio/:file', async (c) => {
  const clip = SAMPLE_CLIPS[c.req.param('file')]

  if (!clip) {
    return c.json({ error: 'Clip not found' }, 404)
  }

  try {
    const audio = await readFile(clip.path)

    return c.body(audio, 200, {
      'Content-Type': clip.type,
      'Content-Length': String(audio.byteLength),
      'Cache-Control': 'public, max-age=300',
    })
  } catch {
    return c.json({ error: 'Clip not generated yet' }, 404)
  }
})
