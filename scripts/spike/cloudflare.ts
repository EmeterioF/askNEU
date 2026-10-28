import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

export const ACCOUNT_ID = requireEnvironment('CF_ACCOUNT_ID')
export const API_TOKEN = requireEnvironment('CF_API_TOKEN')

export function requireEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is missing from .env.local`)
  }
  return value
}

export async function runModel(model: string, input: unknown): Promise<unknown> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  )

  const body: unknown = await response.json()
  if (!response.ok) {
    let detail = ''
    if (body && typeof body === 'object' && 'errors' in body) {
      const errors = (body as { errors: unknown }).errors
      if (Array.isArray(errors)) {
        detail = errors
          .map((item) => {
            if (!item || typeof item !== 'object') return ''
            const error = item as { code?: unknown; message?: unknown }
            return [error.code, error.message].filter((value) => typeof value === 'string').join(': ')
          })
          .filter(Boolean)
          .join('; ')
      }
    }
    throw new Error(
      `Cloudflare request failed with HTTP ${response.status}${detail ? ` (${detail})` : ''}`,
    )
  }
  return body
}

export function resultOf(body: unknown): unknown {
  if (!body || typeof body !== 'object' || !('result' in body)) {
    throw new Error('Cloudflare returned an unexpected response')
  }
  return (body as { result: unknown }).result
}

export function audioBytes(body: unknown): Buffer {
  const result = resultOf(body)
  if (typeof result === 'string') {
    return Buffer.from(result, 'base64')
  }
  if (result && typeof result === 'object' && 'audio' in result) {
    const audio = (result as { audio: unknown }).audio
    if (typeof audio === 'string') {
      return Buffer.from(audio, 'base64')
    }
    if (Array.isArray(audio) && audio.every((item) => Number.isInteger(item))) {
      return Buffer.from(audio)
    }
  }
  throw new Error('Cloudflare response did not contain audio bytes')
}
