import { neon } from '@neondatabase/serverless'
import {drizzle} from 'drizzle-orm/neon-http'
import * as schema from './tables/app.js'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured')
}

export const sql = neon(databaseUrl) //main db if you need to talk to the db without the drizzle wrappr //used by the db healht check in app.ts
export const db = drizzle(sql, {schema}) // the db that is wrapped with drizzle so you can use select().tableName() later