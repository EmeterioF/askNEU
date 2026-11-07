const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4/accounts'

function getCloudflareUrl(model: string) {
  const accountId = process.env.CF_ACCOUNT_ID

  if (!accountId) {
    throw new Error('CF_ACCOUNT_ID is not configured')
  }

  return `${CLOUDFLARE_API}/${accountId}/ai/run/${model}`
}

async function runCloudflare(model: string, body: unknown, timeoutMs: number) {
  const token = process.env.CF_API_TOKEN

  if (!token) {
    throw new Error('CF_API_TOKEN is not configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(getCloudflareUrl(model), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Cloudflare AI request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as {
      success?: boolean
      result?: unknown
      errors?: unknown
    }

    if (payload.success === false || payload.result === undefined) {
      throw new Error('Cloudflare AI returned no result')
    }

    return payload.result
  } finally {
    clearTimeout(timeout)
  }
}

async function runCloudflareBinary(
  model: string,
  body: unknown,
  timeoutMs: number,
) {
  const token = process.env.CF_API_TOKEN

  if (!token) {
    throw new Error('CF_API_TOKEN is not configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(getCloudflareUrl(model), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Cloudflare AI request failed with status ${response.status}`)
    }

    return Buffer.from(await response.arrayBuffer())
  } finally {
    clearTimeout(timeout)
  }
}

export async function transcribeAudio(audio: ArrayBuffer) {
  const result = await runCloudflare(
    '@cf/openai/whisper-large-v3-turbo',
    { audio: Buffer.from(audio).toString('base64') },
    3000,
  )

  if (
    typeof result !== 'object' ||
    result === null ||
    !('text' in result) ||
    typeof result.text !== 'string'
  ) {
    throw new Error('Whisper returned an invalid transcript')
  }

  return result.text.trim()
}

export async function pickFaq(system: string, user: string) {
  const result = await runCloudflare(
    '@cf/openai/gpt-oss-20b',
    {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      max_tokens: 80,
    },
    2500,
  )

  if (typeof result === 'string') {
    return result
  }

  if (
    typeof result === 'object' &&
    result !== null &&
    'response' in result &&
    typeof result.response === 'string'
  ) {
    return result.response
  }

  throw new Error('FAQ picker returned an invalid response')
}

export async function synthesizeSpeech(text: string) {
  if (!text.trim()) {
    throw new Error('Cannot synthesize empty text')
  }

  return runCloudflareBinary(
    '@cf/deepgram/aura-2-en',
    {
      text,
      speaker: 'luna',
      encoding: 'mp3',
      container: 'none',
    },
    5000,
  )
}
