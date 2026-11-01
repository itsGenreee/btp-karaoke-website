import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { listServices, studioToday } from '../modules/bookings/index.ts'
import { listPublicMedia } from '../modules/media/index.ts'
import { getUserMembership } from '../modules/membership/index.ts'
import { getGcashQrUrl } from '../modules/settings/index.ts'
import { sendPhoneVerificationOtp, verifyPhoneOtp } from '../modules/users/verification.ts'
import { requireSession } from '../middleware/session.ts'

const publicApi = new Hono()

// Example protected route — returns 401 unless signed in.
publicApi.get('/me', requireSession, (c) => {
  const session = c.get('session')
  if (!session) {
    throw new HTTPException(401)
  }
  return c.json({ user: session.user })
})

publicApi.post('/me/phone/send-otp', requireSession, async (c) => {
  const session = c.get('session')
  if (!session) throw new HTTPException(401)
  try {
    const result = await sendPhoneVerificationOtp(session.user.id)
    return c.json(result)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to send OTP' }, 400)
  }
})

publicApi.post('/me/phone/verify-otp', requireSession, async (c) => {
  const session = c.get('session')
  if (!session) throw new HTTPException(401)
  try {
    const body = await c.req.json<{ otp?: string }>()
    if (!body.otp) {
      return c.json({ error: 'OTP is required' }, 400)
    }
    const result = await verifyPhoneOtp(session.user.id, body.otp)
    return c.json(result)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to verify OTP' }, 400)
  }
})

// Public: the catalog is marketing copy, no session needed to browse it.
// `studioToday` lets the booking form set its minimum date in the studio's
// own timezone rather than trusting the visitor's clock.
publicApi.get('/services', async (c) => {
  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  const services = await listServices()
  return c.json({ services, studioToday: studioToday() })
})

publicApi.get('/media', async (c) => {
  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  const items = await listPublicMedia()
  return c.json({ items })
})

// Signed-in: the caller's own membership tier + expiry.
publicApi.get('/me/membership', requireSession, async (c) => {
  c.header('Cache-Control', 'private, no-store')
  const session = c.get('session')
  if (!session) throw new HTTPException(401)
  const membership = await getUserMembership(session.user.id)
  return c.json({ membership })
})

// Public: the GCash QR code uploaded by an admin (null if not set yet).
publicApi.get('/settings/gcash-qr', async (c) => {
  const url = await getGcashQrUrl()
  return c.json({ url })
})

export default publicApi

