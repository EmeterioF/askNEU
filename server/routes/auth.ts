import { Hono } from 'hono'
import { auth } from '../db/auth.js'

export const authRoutes = new Hono()

authRoutes.all('/*', (c) => auth.handler(c.req.raw))
