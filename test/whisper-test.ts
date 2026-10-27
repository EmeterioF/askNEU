import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { resultOf, runModel } from './cloudflare.js'

const MODEL = '@cf/openai/whisper-large-v3-turbo'
const MIN_DURATION_MS = 800
const SILENCE_RMS_THRESHOLD = 250
const files = [
  'test/audio/question-8s.wav',
  'test/audio/tap-04s.wav',
  'test/audio/silence-3s.wav',
]

function wavInfo(audio: Buffer): { durationMs: number; rms: number } {
  if (audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Expected a PCM WAV file')
  }

  const channels = audio.readUInt16LE(22)
  const sampleRate = audio.readUInt32LE(24)
  const bitsPerSample = audio.readUInt16LE(34)
  const dataOffset = audio.indexOf('data', 36, 'ascii')
  if (channels !== 1 || bitsPerSample !== 16 || dataOffset < 0) {
    throw new Error('Expected mono 16-bit PCM WAV')
  }

  const dataLength = audio.readUInt32LE(dataOffset + 4)
  const dataStart = dataOffset + 8
  const sampleCount = Math.floor(dataLength / 2)
  let sumSquares = 0
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = audio.readInt16LE(dataStart + index * 2)
    sumSquares += sample * sample
  }

  return {
    durationMs: Math.round((sampleCount / sampleRate) * 1000),
    rms: Math.sqrt(sumSquares / Math.max(sampleCount, 1)),
  }
}

async function testFile(file: string, initialPrompt?: string): Promise<void> {
  const audio = await readFile(file)
  const info = wavInfo(audio)
  const started = performance.now()
  if (info.durationMs < MIN_DURATION_MS || info.rms < SILENCE_RMS_THRESHOLD) {
    console.log(`${file}${initialPrompt ? ' (with vocabulary prompt)' : ''}`)
    console.log(`Local guard: blocked (${info.durationMs} ms, RMS ${Math.round(info.rms)})`)
    console.log('Transcript: [empty]')
    return
  }

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
  console.log(`Audio: ${info.durationMs} ms, RMS ${Math.round(info.rms)}`)
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
