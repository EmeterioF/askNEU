import { timingSafeEqual } from 'node:crypto'
import { createMiddleware } from 'hono/factory'

export type DeviceEnv = {
  Variables: {
    // stable identifier for the calling kiosk, used for rate limiting later
    deviceId: string
  }
}

function safeEqual(a: string, b: string) {
  const provided = Buffer.from(a)
  const expected = Buffer.from(b)

  if (provided.length !== expected.length) {
    return false
  }

  return timingSafeEqual(provided, expected)
}

// Kiosk routes are authorised by a shared secret in the X-Device-Token header.
// Fails closed when DEVICE_TOKEN is missing so a misconfigured deploy cannot be
// driven by anyone who finds the URL.
export const requireDeviceToken = createMiddleware<DeviceEnv>(async (c, next) => {
  const expected = process.env.DEVICE_TOKEN

  if (!expected) {
    console.error('DEVICE_TOKEN is not set; refusing kiosk request')

    return c.json({ error: 'Device token not configured' }, 500)
  }

  const provided = c.req.header('x-device-token') ?? ''

  if (!safeEqual(provided, expected)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('deviceId', c.req.header('x-device-id') ?? 'kiosk')

  await next()
})
