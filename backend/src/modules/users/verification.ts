import { eq } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { user } from '../../db/schema.ts'
import { sendSms } from '../notifications/sms.ts'

export async function sendPhoneVerificationOtp(userId: string) {
  const [dbUser] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!dbUser) {
    throw new Error('User not found')
  }

  if (!dbUser.contactNum) {
    throw new Error('No contact number set on profile')
  }

  // Generate 6-digit OTP only
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  await db
    .update(user)
    .set({
      phoneOtp: otp,
      phoneOtpExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))

  const message = `Your BTP Karaoke verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`
  const smsResult = await sendSms(dbUser.contactNum, message)

  return {
    success: true,
    smsResult,
  }
}

export async function verifyPhoneOtp(userId: string, otp: string) {
  if (!/^\d{6}$/.test(otp)) {
    throw new Error('Invalid OTP format. Must be a 6-digit number.')
  }

  const [dbUser] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!dbUser) {
    throw new Error('User not found')
  }

  if (!dbUser.phoneOtp || !dbUser.phoneOtpExpiresAt) {
    throw new Error('No active OTP request found')
  }

  if (new Date() > new Date(dbUser.phoneOtpExpiresAt)) {
    throw new Error('OTP has expired')
  }

  if (dbUser.phoneOtp !== otp) {
    throw new Error('Incorrect OTP')
  }

  await db
    .update(user)
    .set({
      contactVerified: true,
      phoneOtp: null,
      phoneOtpExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))

  return {
    success: true,
    message: 'Contact number successfully verified',
  }
}
