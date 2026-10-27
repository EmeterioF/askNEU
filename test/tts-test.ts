import { mkdir, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { audioBytes, resultOf, runModel } from './cloudflare.js'

const MODEL = '@cf/myshell-ai/melotts'
const OUTPUT = 'test/output/melotts-sample.mp3'
const TEXT = "Please proceed to the Registrar's Office for assistance."

async function main(): Promise<void> {
  const started = performance.now()
  const body = await runModel(MODEL, { prompt: TEXT, lang: 'en' })
  const bytes = audioBytes(body)
  await mkdir('test/output', { recursive: true })
  await writeFile(OUTPUT, bytes)

  console.log(`Model: ${MODEL}`)
  console.log(`Latency: ${Math.round(performance.now() - started)} ms`)
  console.log(`Audio bytes: ${bytes.length}`)
  console.log(`Saved: ${OUTPUT}`)
  console.log(`Response result type: ${typeof resultOf(body)}`)
  console.log('Playback check: open the saved file in a media player')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'TTS test failed')
  process.exitCode = 1
})
