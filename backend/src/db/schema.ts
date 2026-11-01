import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * Drizzle schema — the tables THIS APPLICATION owns.
 *
 * Ownership split, so nobody clobbers anyone:
 *   - Better Auth owns "user" / "session" / "account" / "verification". Those
 *     are created and re-created by `bun x auth@latest migrate` from
 *     backend/better-auth_migrations/, NOT from here.
 *   - Drizzle owns "service", "booking" and "media_item" (backend/drizzle/
 *     migrations). It also adds the `role` and profile-location columns to
 *     Better Auth's `user` table through migrations 0001 and 0007.
 *
 * `user` is declared below so `booking.userId` can carry a real database
 * foreign key and so the snapshot mirrors the columns Better Auth manages. Its
 * CREATE is deliberately stripped out of the generated migration — see
 * backend/drizzle/0000_*.sql. On a fresh database, run
 * `bun x auth@latest migrate` BEFORE `npm run migrate`, or the booking FK has
 * nothing to point at.
 *
 * Never run `drizzle-kit push` against this database: it reconciles the whole
 * database against this file and would happily drop the Better Auth tables it
 * cannot see.
 */

export const BOOKING_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/**
 * Reference target for booking.userId — NOT owned by Drizzle.
 * Columns mirror better-auth_migrations/2026-10-08T10-52-54.722Z.sql plus the
 * additionalFields in src/auth.ts, so the snapshot stays honest.
 */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull(),
  image: text('image'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  contactNum: text('contact_num').notNull(),
  contactVerified: boolean('contact_verified').notNull().default(false),
  phoneOtp: text('phone_otp'),
  phoneOtpExpiresAt: timestamp('phone_otp_expires_at', { withTimezone: true }),
  /**
   * Philippines location, nullable for accounts that have not set one yet.
   * Barangay + city/municipality + province only — no street address.
   * Declared in src/auth.ts (additionalFields), added to an existing database
   * by drizzle/0007_*.sql, and guarded on update by src/location.ts.
   */
  province: text('province'),
  cityMunicipality: text('city_municipality'),
  barangay: text('barangay'),
  /**
   * Authorization flag: 'user' (default) or 'admin'. Mirrored here so the
   * column can ride the normal Drizzle migration path (drizzle/0001_*.sql);
   * Better Auth reads it through `user.additionalFields.role` in src/auth.ts,
   * which is also what keeps it out of client input — nobody can set their own
   * role through sign-up or /api/auth/update-user. Promote an account with
   * `npm run promote-admin -- email@example.com` (scripts/promote-admin.ts).
   */
  role: text('role').notNull().default('user'),
  /**
   * Membership tier for perks: 'free' (default), 'subscriber' (ad-free
   * streaming) or 'vip' (20% off services). Granted/revoked by admins only;
   * clients cannot set it (input: false in auth.ts).
   */
  membershipTier: text('membership_tier').notNull().default('free'),
  membershipExpiresAt: timestamp('membership_expires_at', { withTimezone: true }),
  /** Booking abuse tracking: suspended until this time after repeated unpaid holds. */
  bookingSuspendedUntil: timestamp('booking_suspended_until', { withTimezone: true }),
  bookingFailureCount: integer('booking_failure_count').notNull().default(0),
}, (t) => [
  check('user_membership_tier_check', sql`"membership_tier" in ('free', 'subscriber', 'vip')`),
])

/**
 * Bookable catalog. Rows mirror the priced services on /services.
 * A service never references a user — the booking row is that join.
 */
export const service = pgTable('service', {
  id: text('id').primaryKey(),
  /** Stable human-readable key, e.g. "STUDIO-TRACKING". Seed upserts on this. */
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  /** Service wing: create | promote | learn | protect */
  wing: text('wing').notNull(),
  description: text('description').notNull(),
  /** Billing unit as shown on /services, e.g. "Per Composition". */
  unit: text('unit').notNull(),
  /**
   * Sample PHP price. numeric keeps money exact; node-postgres hands numerics
   * back as strings, so the API layer converts once (src/bookings.ts).
   */
  pricePhp: numeric('price_php', { precision: 12, scale: 2 }).notNull(),
  /** Turnaround metadata for the future time-block work — not a day claim. */
  durationDays: integer('duration_days').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * The media hub catalog behind /studio: one row per card, across three
 * sections. Admin-managed from /admin/media; the public hub reads the active
 * rows only. Section-specific display columns (duration/plays, tempo/key,
 * freq/listeners) are nullable — a row fills only its section's pair.
 */
export const mediaItem = pgTable(
  'media_item',
  {
    id: text('id').primaryKey(),
    /** Hub section: video | music | radio. */
    section: text('section').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    /**
     * Performer — read from the file's own artist tag or typed by the admin.
     * Video and music cards show it under the title; radio rows leave it null
     * (their subtitle carries the genre).
     */
    artist: text('artist'),
    /** Chip label on the card ("KTV", "MIX", "On Air"…). */
    tag: text('tag'),
    /**
     * Video/music: runtime as shown, e.g. "3:54". The editor reads it off
     * the uploaded file (MP4 or MP3) — it is never typed by hand.
     */
    duration: text('duration'),
    /** Video: display-only play count. */
    plays: integer('plays'),
    /** Music: tempo as shown, e.g. "118 BPM". */
    tempo: text('tempo'),
    /** Music: musical key as shown, e.g. "Fmaj". */
    songKey: text('songKey'),
    /** Radio: dial position as shown, e.g. "FM 91.5". */
    freq: text('freq'),
    /** Radio: display-only listener count. */
    listeners: integer('listeners'),
    /**
     * The uploaded MP4/MP3 this row actually plays, as returned by the media
     * uploader (`/api/uploads/media/<uuid>.<ext>`). NULL means video rows fall
     * back to the bundled local master and music rows have no audio yet.
     */
    sourceUrl: text('sourceUrl'),
    /** Original filename of the upload, shown in the console editor only. */
    sourceName: text('sourceName'),
    /**
     * Album / collection, read from the file's tags or typed by the admin.
     * Music cards show it in the meta strip.
     */
    album: text('album'),
    /**
     * Optional track lyrics — multi-line plain text the admin types or pastes
     * in the editor's Lyrics box. NULL means none were written.
     */
    lyrics: text('lyrics'),
    /**
     * Cover art / thumbnail behind the hub card, the console stage poster
     * and the player bar — an uploaded image (`/api/uploads/media/<uuid>.<ext>`
     * returned by the media uploader). NULL = the default art.
     */
    coverUrl: text('coverUrl'),
    /** Original filename of the cover upload, console display only. */
    coverName: text('coverName'),
    /** Display order within the section; ties fall back to title. */
    sortOrder: integer('sortOrder').notNull().default(0),
    /** false hides the row from /api/media without deleting it. */
    isActive: boolean('isActive').notNull().default(true),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('media_item_section_check', sql`"section" in ('video', 'music', 'radio')`),
  ],
)

/**
 * One service, one customer, one day. The customer is either a registered
 * user (`userId`) or, for reservations the admin takes by phone or walk-in,
 * a free-text `guestName`. Day-only: there is no time slot or time block
 * column yet — that arrives as its own migration.
 */
export const booking = pgTable(
  'booking',
  {
    id: text('id').primaryKey(),
    /** Customer-facing code ("BTP-7K2F9A"); safe to read out over the phone. */
    referenceCode: text('referenceCode').notNull().unique(),
    /**
     * The customer, when the booking belongs to a registered account.
     * NULL for a reservation the admin took for a walk-in / phone caller —
     * those carry `guestName` instead. The check constraint below enforces
     * that every booking has at least one of the two.
     */
    userId: text('userId').references(() => user.id, { onDelete: 'cascade' }),
    /** Guest (non-account) customer name, admin-created reservations only. */
    guestName: text('guestName'),
    // onDelete restrict: a service with bookings cannot vanish from under
    // them — deactivate it with isActive = false instead.
    serviceId: text('serviceId')
      .notNull()
      .references(() => service.id, { onDelete: 'restrict' }),
    /** Whole day, ISO `YYYY-MM-DD`. No time component. bookingTime holds the per-hour slot when set. */
    bookingDate: date('bookingDate', { mode: 'string' }).notNull(),
    /** Optional time slot `HH:MM:SS` for per-hour services. NULL = per-day booking. Time is stored in studio local time (PH timezone). */
    bookingTime: time('bookingTime'),
    /**
     * pending is what an admin later acts on: confirmed | rejected.
     * cancelled is the customer withdrawing; completed follows the session.
     */
    status: text('status').$type<BookingStatus>().notNull().default('pending'),
    notes: text('notes'),
    /** Payment method chosen: 'filler' (cash/bank) or 'gcash'. */
    paymentMethod: text('payment_method'),
    /** Uploaded receipt image URL (GCash screenshot). */
    receiptUrl: text('receipt_url'),
    /** Deadline for completing payment; expired holds are auto-cancelled. */
    paymentDeadline: timestamp('payment_deadline', { withTimezone: true }),
    /** Percent off the listed price granted by the customer's membership tier. */
    discountPercent: integer('discount_percent').notNull().default(0),
    /** Final amount due after the discount (defaults to the listed price). */
    amountDuePhp: numeric('amount_due_php', { precision: 12, scale: 2 }),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('booking_userId_idx').on(t.userId),
    index('booking_serviceId_idx').on(t.serviceId),
    index('booking_bookingDate_idx').on(t.bookingDate),
    check(
      'booking_status_check',
      sql`"status" in ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')`,
    ),
    // Every booking needs an owner: a registered user or a guest name.
    check('booking_owner_check', sql`"userId" is not null or "guestName" is not null`),
    // One live booking per user, per service, per day (time = NULL).
    // Partial: cancelled/rejected rows drop out so the customer can rebook.
    uniqueIndex('booking_active_day_unique_idx')
      .on(t.userId, t.serviceId, t.bookingDate)
      .where(sql`"bookingTime" IS NULL AND "status" in ('pending', 'confirmed')`),
    // One live booking per user, per service, per day AND time slot (time IS NOT NULL).
    uniqueIndex('booking_active_time_unique_idx')
      .on(t.userId, t.serviceId, t.bookingDate, t.bookingTime)
      .where(sql`"bookingTime" IS NOT NULL AND "status" in ('pending', 'confirmed')`),
  ],
)

/**
 * A day the studio is closed to new bookings — admin-managed from
 * `/admin/bookings`. The reason is optional (NULL = "no reason given") and
 * constrained to a small vocabulary so the UI can label it without parsing
 * free text; `note` is internal context the admin sees, never the customer.
 *
 * Full-day only today: the unique index allows exactly one row per day. A
 * future partial-day/time-range closure can reuse the same table by adding
 * start/end columns and replacing the index with a partial one — keep the
 * public `bookingDate` + `reason` shape stable when that lands.
 */
export const BOOKING_BLOCKOUT_REASONS = ['unavailable', 'maintenance', 'other'] as const

export type BookingBlockoutReason = (typeof BOOKING_BLOCKOUT_REASONS)[number]

export const bookingBlockout = pgTable(
  'booking_blockout',
  {
    id: text('id').primaryKey(),
    /** Whole day, ISO `YYYY-MM-DD`. One blockout row per day. */
    bookingDate: date('bookingDate', { mode: 'string' }).notNull(),
    /** NULL means the admin did not give a reason. */
    reason: text('reason').$type<BookingBlockoutReason>(),
    /** Admin-only context, e.g. "Annual electrical maintenance". */
    note: text('note'),
    /** Admin account that created the block; kept for audit if the account goes. */
    createdBy: text('createdBy').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('booking_blockout_day_unique_idx').on(t.bookingDate),
    check(
      'booking_blockout_reason_check',
      sql`"reason" is null or "reason" in ('unavailable', 'maintenance', 'other')`,
    ),
  ],
)

/**
 * Simple key/value store for site-wide settings (e.g. the GCash QR image URL).
 */
export const siteSetting = pgTable('site_setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})
