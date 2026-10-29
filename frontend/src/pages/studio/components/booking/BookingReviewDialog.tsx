import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import type { Service } from '../../../../lib/booking-api'
import { formatDay, peso, formatTime12h } from '../../../../lib/booking-format'

type BookingReviewDialogProps = {
  service: Service
  bookingDate: string
  /** `HH:MM` (or `HH:MM:SS`) for time-based services, omitted otherwise. */
  bookingTime?: string
  customerName: string
  customerContact: string
  amountDuePhp: number
  discountPercent: number
  notes?: string
  error: string
  submitting: boolean
  onBack: () => void
  onConfirm: () => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 py-2.5 last:border-b-0">
      <span className="text-[11px] font-bold tracking-widest text-text-muted uppercase">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-text-primary">{value}</span>
    </div>
  )
}

export default function BookingReviewDialog({
  service,
  bookingDate,
  bookingTime,
  customerName,
  customerContact,
  amountDuePhp,
  discountPercent,
  notes,
  error,
  submitting,
  onBack,
  onConfirm,
}: BookingReviewDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-review-heading"
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-primary uppercase">
              Review booking
            </p>
            <h2
              id="booking-review-heading"
              className="mt-1 font-heading text-lg leading-tight font-bold tracking-wide uppercase"
            >
              {service.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            aria-label="Back to booking form"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-text-muted transition hover:bg-surface-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        <div className="rounded-lg border border-border bg-background px-4 py-1">
          <DetailRow label="Service" value={service.name} />
          <DetailRow label="Date" value={formatDay(bookingDate)} />
          {bookingTime && (
            <DetailRow label="Time" value={formatTime12h(bookingTime)} />
          )}
          <DetailRow label="Name" value={customerName} />
          <DetailRow label="Contact number" value={customerContact} />
          <DetailRow
            label="Price"
            value={
              discountPercent > 0
                ? `${peso.format(amountDuePhp)} (VIP ${discountPercent}% off ${peso.format(service.pricePhp)})`
                : peso.format(amountDuePhp)
            }
          />
          {notes?.trim() && <DetailRow label="Notes" value={notes.trim()} />}
        </div>

        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] font-semibold text-warning">
          Confirming holds this slot for 5 minutes while you choose a payment method. No payment
          is taken yet.
        </p>

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Holding slot…' : 'Confirm & hold slot'}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-text-secondary transition hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
