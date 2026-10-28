import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const required = ['STAFF_NAME', 'STAFF_EMAIL', 'STAFF_PASSWORD']
for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`${name} is missing from the local environment`)
  }
}

if (process.env.STAFF_PASSWORD!.length < 8) {
  throw new Error('STAFF_PASSWORD must be at least 8 characters')
}

// This controlled script uses Better Auth's signup API only to bootstrap the
// first account; public signup remains disabled in the application config.
process.env.DISABLE_SIGNUP = 'false'

const { auth } = await import('../server/db/auth.js')

try {
  await auth.api.signUpEmail({
    body: {
      name: process.env.STAFF_NAME!,
      email: process.env.STAFF_EMAIL!,
      password: process.env.STAFF_PASSWORD!,
    },
  })

  console.log(`Created staff account for ${process.env.STAFF_EMAIL}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Staff account creation failed')
  process.exitCode = 1
}
