import type { BookingStatus } from './booking-api'


export const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: 'border-warning/40 bg-warning/10 text-warning',
  confirmed: 'border-success/40 bg-success/10 text-success',
  rejected: 'border-error/40 bg-error/10 text-error',
  cancelled: 'border-border bg-surface-elevated text-text-muted',
  completed: 'border-primary/40 bg-primary-soft text-primary',
}

export const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

const dayFormat = new Intl.DateTimeFormat('en-PH', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatDay(isoDate: string): string {
  return dayFormat.format(new Date(`${isoDate}T00:00:00Z`))
}

export function formatTime12h(timeStr: string): string {
  if (!timeStr) return ''
  const parts = timeStr.slice(0, 5).split(':')
  if (parts.length < 2) return timeStr
  let hours = parseInt(parts[0], 10)
  const minutes = parts[1]
  if (isNaN(hours)) return timeStr
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`
}

/**
 * The first day at or after `startIso` that is not blocked. Used to prefill the
 * date field so a closed "today" does not greet the customer with an error.
 * Falls back to `startIso` after 90 closed days — long enough for any real
 * closure, short enough not to spin on bad data.
 */
export function nextOpenDay(startIso: string, isBlocked: (day: string) => boolean): string {
  const date = new Date(`${startIso}T00:00:00Z`)
  for (let offset = 0; offset < 90; offset += 1) {
    const day = date.toISOString().slice(0, 10)
    if (!isBlocked(day)) return day
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return startIso
}
