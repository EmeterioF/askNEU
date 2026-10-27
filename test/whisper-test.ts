import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { resultOf, runModel } from './cloudflare.js'

const MODEL = '@cf/openai/whisper-large-v3-turbo'
const files = [
  'test/audio/question-8s.wav',
  'test/audio/tap-04s.wav',
  'test/audio/silence-3s.wav',
]

async function testFile(file: string, initialPrompt?: string): Promise<void> {
  const audio = await readFile(file)
  const started = performance.now()
  const body = await runModel(MODEL, {
    audio: audio.toString('base64'),
    task: 'transcribe',
    language: 'en',
    ...(initialPrompt ? { initial_prompt: initialPrompt } : {}),
  })
  const result = resultOf(body)
  const text =
    result && typeof result === 'object' && 'text' in result
      ? (result as { text: unknown }).text
      : undefined

  console.log(`${file}${initialPrompt ? ' (with vocabulary prompt)' : ''}`)
  console.log(`Latency: ${Math.round(performance.now() - started)} ms`)
  console.log(`Transcript: ${typeof text === 'string' ? text : '[missing text]'}`)
}

async function main(): Promise<void> {
  const prompt = 'Northeastern University, registrar, accounting, tuition, transcript, enrollment'
  for (const file of files) {
    await testFile(file)
    await testFile(file, prompt)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Whisper test failed')
  console.error('Create test/audio/question-8s.wav, tap-04s.wav, and silence-3s.wav first.')
  process.exitCode = 1
})
