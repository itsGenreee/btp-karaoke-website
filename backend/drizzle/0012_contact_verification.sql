ALTER TABLE "user" ADD COLUMN "contact_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone_otp" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone_otp_expires_at" timestamp with time zone;
