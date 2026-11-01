import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  PencilIcon,
  Settings01Icon,
  UserIcon,
  Mail01Icon,
  PhoneIcon,
  MusicNote01Icon,
  Camera01Icon,
} from '@hugeicons/core-free-icons'
import { authClient } from '../../../../lib/auth-client'
import { readableError, unexpectedError } from '../../../../lib/auth-errors'
import UserAvatar from '../../../../components/UserAvatar'
import DetailField from './DetailField'
import LocationSection from './LocationSection'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog'
import type { ProfileIdentity } from './types'

type AccountTabProps = {
  identity: ProfileIdentity
  onLocationSaved: () => void | Promise<void>
  onImageSaved?: () => void | Promise<void>
  onPhoneVerified?: () => void | Promise<void>
}

export default function AccountTab({ identity, onLocationSaved, onImageSaved, onPhoneVerified }: AccountTabProps) {
  const { image, fullName, email, emailVerified, phone, phoneVerified, handle, memberSince, location } = identity

  const CROP_SIZE = 256
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 })
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cropViewportRef = useRef<HTMLDivElement>(null)

  const [otpModalOpen, setOtpModalOpen] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpSuccess, setOtpSuccess] = useState('')

  async function handleSendOtp() {
    setOtpLoading(true)
    setOtpError('')
    setOtpSuccess('')
    try {
      const res = await fetch('/api/me/phone/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP')
      }
      setOtpSuccess('6-digit OTP sent successfully via SMS!')
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Failed to send OTP')
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleVerifyOtp() {
    if (!/^\d{6}$/.test(otpCode)) {
      setOtpError('Please enter a valid 6-digit number.')
      return
    }
    setOtpLoading(true)
    setOtpError('')
    setOtpSuccess('')
    try {
      const res = await fetch('/api/me/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otpCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Invalid OTP')
      }
      setOtpSuccess('Phone number verified successfully!')
      setTimeout(() => {
        setOtpModalOpen(false)
        onPhoneVerified?.()
      }, 1500)
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setOtpLoading(false)
    }
  }

  function openAvatarModal() {
    setAvatarError('')
    setAvatarOpen(true)
  }

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc)
    }
  }, [cropSrc])

  useEffect(() => {
    if (!naturalSize.w || !naturalSize.h) return
    const minZoom = Math.max(0.1, CROP_SIZE / Math.min(naturalSize.w, naturalSize.h))
    const z = Math.max(zoom, minZoom)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (z !== zoom) setZoom(z)
    const maxX = Math.max(0, (naturalSize.w * z - CROP_SIZE) / 2)
    const maxY = Math.max(0, (naturalSize.h * z - CROP_SIZE) / 2)
    setOffset((current) => ({
      x: Math.max(-maxX, Math.min(maxX, current.x)),
      y: Math.max(-maxY, Math.min(maxY, current.y)),
    }))
  }, [zoom, naturalSize])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image must be 2 MB or smaller.')
      return
    }
    setAvatarError('')
    setAvatarOpen(false)
    const url = URL.createObjectURL(file)
    setCropSrc((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return url
    })
    setNaturalSize({ w: 0, h: 0 })
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setCropOpen(true)
  }

  async function handleSaveCrop() {
    if (!cropSrc || !naturalSize.w || !naturalSize.h) {
      setAvatarError('Choose an image first.')
      return
    }
    setSavingAvatar(true)
    setAvatarError('')
    try {
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Could not read the image.'))
        image.src = cropSrc
      })

      const minZoom = Math.max(0.1, CROP_SIZE / Math.min(naturalSize.w, naturalSize.h))
      const z = Math.max(zoom, minZoom)
      const sw = CROP_SIZE / z
      const sh = CROP_SIZE / z
      const sx = naturalSize.w / 2 - offset.x / z - sw / 2
      const sy = naturalSize.h / 2 - offset.y / z - sh / 2
      const clampedSx = Math.max(0, Math.min(naturalSize.w - sw, sx))
      const clampedSy = Math.max(0, Math.min(naturalSize.h - sh, sy))

      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not prepare the cropped image.')
      context.drawImage(image, clampedSx, clampedSy, sw, sh, 0, 0, 512, 512)
      context.globalCompositeOperation = 'destination-in'
      context.beginPath()
      context.arc(256, 256, 256, 0, Math.PI * 2)
      context.fill()
      const dataUrl = canvas.toDataURL('image/png')

      const { error } = await authClient.updateUser({ image: dataUrl })
      if (error) {
        setAvatarError(readableError(error))
        return
      }
      setCropOpen(false)
      setCropSrc((previous) => {
        if (previous) URL.revokeObjectURL(previous)
        return null
      })
      await onImageSaved?.()
    } catch (err) {
      setAvatarError(unexpectedError('profile image update', err))
    } finally {
      setSavingAvatar(false)
    }
  }

  async function handleRemoveAvatar() {
    setSavingAvatar(true)
    setAvatarError('')
    try {
      const { error } = await authClient.updateUser({ image: null })
      if (error) {
        setAvatarError(readableError(error))
        return
      }
      setAvatarOpen(false)
      await onImageSaved?.()
    } catch (err) {
      setAvatarError(unexpectedError('profile image removal', err))
    } finally {
      setSavingAvatar(false)
    }
  }

  return (
    <>
      <section className="flex flex-wrap items-start gap-5 rounded-xl border border-border bg-surface p-6">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={openAvatarModal}
            className="group relative block overflow-hidden rounded-xl"
            aria-label="Change profile photo"
          >
            <UserAvatar
              image={image}
              icon={UserIcon}
              iconSize={36}
              className="size-24 rounded-xl"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
              <HugeiconsIcon icon={Camera01Icon} size={18} />
            </span>
          </button>
          <span className="absolute -right-1 -bottom-1 size-4 rounded-full border-2 border-surface bg-success" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-bold tracking-wide uppercase">{fullName}</h1>
            <span className="rounded border border-border px-2 py-0.5 text-[10px] font-bold tracking-widest text-text-secondary uppercase">
              Standard Member
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {handle}
            {memberSince && <> · Member since {memberSince}</>}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">
            Karaoke lover and acoustic enthusiast. Singing along to classic OPM and pop hits!
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-primary-hover"
          >
            <HugeiconsIcon icon={PencilIcon} size={15} />
            Edit Profile
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-text-primary"
          >
            <HugeiconsIcon icon={Settings01Icon} size={15} />
            Settings
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={UserIcon} size={18} className="text-primary" />
            <h2 className="font-heading text-lg font-bold tracking-widest uppercase">Personal Details</h2>
          </div>
          <button type="button" className="flex items-center gap-1 text-xs font-semibold text-primary transition hover:text-primary-hover">
            <HugeiconsIcon icon={PencilIcon} size={13} />
            Update
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <DetailField
            icon={UserIcon}
            label="Full Name"
            value={fullName}
            hint="Display name across singing sessions"
          />
          <DetailField
            icon={Mail01Icon}
            label="Email Address"
            value={email}
            hint="Primary Email"
            verified={emailVerified}
          />
          <div className="rounded-lg border border-border bg-surface-elevated p-4 flex flex-col justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-text-muted uppercase">
                <HugeiconsIcon icon={PhoneIcon} size={12} />
                Phone Number
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold break-words text-text-primary">
                {phone}
                {phoneVerified && (
                  <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success uppercase">
                    Verified
                  </span>
                )}
              </p>
              <p className={`mt-0.5 text-[11px] ${phoneVerified ? 'text-success' : 'text-text-muted'}`}>
                {phoneVerified ? 'Contact number verified' : 'Used for room reservation/reminders'}
              </p>
            </div>
            {phone && phone !== 'Not set' && !phoneVerified && (
              <button
                type="button"
                onClick={() => {
                  setOtpModalOpen(true)
                  setOtpCode('')
                  setOtpError('')
                  setOtpSuccess('')
                  handleSendOtp()
                }}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/25"
              >
                Verify Phone Number
              </button>
            )}
          </div>
        </div>
      </section>

      <LocationSection location={location} onSaved={onLocationSaved} />

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={MusicNote01Icon} size={18} className="text-primary" />
            <h2 className="font-heading text-lg font-bold tracking-widest uppercase">Singing &amp; Audio Preferences</h2>
          </div>
          <span className="rounded bg-success/15 px-2 py-0.5 text-[10px] font-bold tracking-widest text-success uppercase">
            Saved
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <DetailField label="Preferred Vocal Range" value="Midrange (B3 – D5)" hint="Used to suggest song keys" />
          <DetailField label="Default Monitor Mix" value="Vocals +3 dB" hint="In-ear balance for rehearsals" />
          <DetailField label="Reverb Preset" value="Hall Warm" hint="Applied on studio playback" />
          <DetailField label="Lyrics Display" value="Large text · Tagalog transliteration" hint="Rehearsal screen overlay" />
        </div>
      </section>

      <Dialog open={otpModalOpen} onOpenChange={setOtpModalOpen}>
        <DialogContent className="border border-border bg-surface text-text-primary">
          <DialogHeader>
            <DialogTitle>Verify Phone Number</DialogTitle>
            <DialogDescription className="text-text-secondary">
              Enter the 6-digit OTP sent to your phone number via SMS.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-text-muted mb-1.5">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-center font-mono text-lg tracking-widest text-text-primary focus:border-primary focus:outline-none"
              />
            </div>

            {otpError && <p role="alert" className="text-sm text-error">{otpError}</p>}
            {otpSuccess && <p className="text-sm text-success">{otpSuccess}</p>}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={otpLoading}
                className="text-xs font-semibold text-primary transition hover:underline disabled:opacity-60"
              >
                Resend Code
              </button>
              <span className="text-xs text-text-muted">Code expires in 5 minutes</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOtpModalOpen(false)}
              disabled={otpLoading}
              className="rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-text-primary disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={otpLoading || otpCode.length !== 6}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {otpLoading ? 'Verifying…' : 'Verify Code'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={avatarOpen} onOpenChange={setAvatarOpen}>
        <DialogContent className="border border-border bg-surface text-text-primary">
          <DialogHeader>
            <DialogTitle>Change profile photo</DialogTitle>
            <DialogDescription className="text-text-secondary">
              Upload a new picture. It will be saved to your account.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <UserAvatar
              image={image}
              icon={UserIcon}
              iconSize={48}
              className="size-32 rounded-xl"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={savingAvatar}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-primary-hover disabled:opacity-60"
              >
                Choose image
              </button>
              {image && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={savingAvatar}
                  className="rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-error disabled:opacity-60"
                >
                  Remove photo
                </button>
              )}
            </div>
            {avatarError && (
              <p role="alert" className="text-sm text-error">{avatarError}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAvatarOpen(false)}
              disabled={savingAvatar}
              className="rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-text-primary disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cropOpen} onOpenChange={setCropOpen}>
        <DialogContent className="border border-border bg-surface text-text-primary">
          <DialogHeader>
            <DialogTitle>Crop profile photo</DialogTitle>
            <DialogDescription className="text-text-secondary">
              Drag to reposition and scroll to zoom. The result will be a square image.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <div
              ref={cropViewportRef}
              className="relative overflow-hidden rounded-full border border-border bg-background"
              style={{ width: CROP_SIZE, height: CROP_SIZE, touchAction: 'none' }}
              onPointerDown={(event) => {
                setDragging(true)
                setDragStart({ x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y })
              }}
              onPointerMove={(event) => {
                if (!dragging) return
                const minZoom = Math.max(0.1, CROP_SIZE / Math.min(naturalSize.w || 1, naturalSize.h || 1))
                const z = Math.max(zoom, minZoom)
                const maxX = Math.max(0, (naturalSize.w * z - CROP_SIZE) / 2)
                const maxY = Math.max(0, (naturalSize.h * z - CROP_SIZE) / 2)
                setOffset({
                  x: Math.max(-maxX, Math.min(maxX, dragStart.ox + (event.clientX - dragStart.x))),
                  y: Math.max(-maxY, Math.min(maxY, dragStart.oy + (event.clientY - dragStart.y))),
                })
              }}
              onPointerUp={() => setDragging(false)}
              onPointerLeave={() => setDragging(false)}
              onWheel={(event) => {
                event.preventDefault()
                const minZoom = Math.max(0.1, CROP_SIZE / Math.min(naturalSize.w || 1, naturalSize.h || 1))
                setZoom((current) => Math.max(minZoom, Math.min(3, current - event.deltaY * 0.001)))
              }}
            >
              {cropSrc && (
                <img
                  src={cropSrc}
                  alt="Crop preview"
                  draggable={false}
                  onLoad={(event) => {
                    const target = event.currentTarget
                    setNaturalSize({ w: target.naturalWidth, h: target.naturalHeight })
                  }}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: naturalSize.w || undefined,
                    height: naturalSize.h || undefined,
                    maxWidth: 'none',
                    maxHeight: 'none',
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                    transformOrigin: 'center center',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                />
              )}
              <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80" />
            </div>

            <div className="flex w-full items-center gap-3 px-2">
              <span className="text-xs font-semibold text-text-secondary">Zoom</span>
              <input
                type="range"
                min={Math.max(0.1, CROP_SIZE / Math.min(naturalSize.w || 1, naturalSize.h || 1))}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="h-2 flex-1 accent-primary"
                aria-label="Zoom crop"
              />
            </div>

            {avatarError && (
              <p role="alert" className="text-sm text-error">{avatarError}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCropOpen(false)
                setCropSrc((previous) => {
                  if (previous) URL.revokeObjectURL(previous)
                  return null
                })
              }}
              disabled={savingAvatar}
              className="rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-text-primary disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCrop}
              disabled={savingAvatar || !cropSrc || !naturalSize.w}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingAvatar ? 'Saving…' : 'Save photo'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
