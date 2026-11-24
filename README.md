# Stillfire Sauna Co. — website and booking system

A static website (GitHub Pages) plus a booking backend (Supabase) and automatic emails (Resend).

## How it fits together

- **The website** is the files in this folder: `index.html`, `styles.css`, `config.js`, `waiver.js`, `app.js`, `owner.js`. No server software. Host them anywhere.
- **The booking system** is a Supabase database defined in `supabase/schema.sql`. Visitors can only call four functions: read prices and taken dates, request a booking, sign as a guest, send a question. They can never read customer records.
- **Double-booking protection** is a database rule (`bookings_no_overlap`), not website code. Two live bookings whose dates touch are refused even if two people submit at the same second. Owner-blocked dates are enforced the same way.
- **Emails** are queued in the `email_outbox` table and sent by `supabase/functions/send-queued-email`. Failed sends retry on their own, up to five times.
- **Calendar feed** (`supabase/functions/calendar-feed`) gives Google Calendar a private address to subscribe to.

## Customer journey

1. Customer picks dates, enters details, confirms the site is suitable, signs the agreement, sends the request. The dates are held.
2. Customer gets "request received"; owner gets "new request".
3. Owner opens **Owner sign-in > Requests**, enters the total, approves or declines. Customer is emailed either way.
4. Owner sends the invoice (outside this system). Paying it confirms the date.
5. Automatic emails: prep checklist 3 days before, "we deliver tomorrow", "pickup tomorrow", thank-you with review link after pickup.
6. Other adults sign through the guest link in the emails, using the booking number.
7. Delivery: go through the walk-through checklist in the agreement and have the renter initial it.

## How it stays monitored

- An email to the owner for every new request and every question.
- A reminder if a request has been waiting more than a day.
- A morning summary (about 7 am Central) whenever something is waiting or a delivery or pickup falls within 7 days. It also flags failed emails.
- The **Emails** tab in the dashboard lists every automatic email and its status.
- The private calendar feed shows bookings and blocks in Google Calendar.

## Go-live checklist

| # | Step | Who |
|---|------|-----|
| 1 | Create the Supabase project (approve the cost prompt), run `supabase/schema.sql`, deploy both functions, put the project URL and publishable key in `config.js`, set `app.config.mailer_url` | Claude, after owner approves |
| 2 | Add the Resend DNS records below at the domain registrar | Owner |
| 3 | In Resend, create an API key. In Supabase > Edge Functions > Secrets, add it as `RESEND_API_KEY` | Owner |
| 4 | Add admin emails: `insert into public.admins (email) values ('you@example.com');` | Claude, once given the emails |
| 5 | Supabase > Authentication > URL Configuration: set Site URL to the live site address. Also set custom SMTP (Resend) so sign-in emails reach every admin | Owner |
| 6 | Owner sign-in > Settings: prices, service area, contact details, owner alert email | Owner |
| 7 | Attorney reviews the agreement. Fill the blanks in `config.js` (`legal`), and bump `waiverVersion` | Owner |
| 8 | Replace the photo placeholders and the bracketed text in `index.html` | Owner / Claude |
| 9 | Turn on GitHub Pages and point the domain at it | Owner / Claude |
| 10 | Make one real test booking end to end, then decline it | Owner |

### Resend DNS records for stillfiresaunaco.com

| Type | Name | Value | Priority |
|------|------|-------|----------|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDdXdg8yiZyE+mHTJkotvQuGlNY8bqQA+xfhJ8k0QwfNNf6MNCLWQSslFAzANj0jV18o74e5Cq8O4blQ27inHr7KGLY5R1NRVQbGvos9fJyYkOk30psLxaZlQGu9CtmqIOUzndKHRJuRE8bNIF1K5kjoLQqDyh7aiARbPhEhVjhpwIDAQAB` | |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | |
| CNAME | `rsend` | `send.forge.rmta.net` | |

## Changing things later

- **Prices, area, contact details:** the dashboard Settings tab. No code changes.
- **Agreement wording:** edit `waiver.js`, then change `waiverVersion` in `config.js`. Each signature stores the version and the full text signed.
- **Email wording:** `supabase/functions/send-queued-email/index.ts`, then redeploy the function.
- **Sender address:** set a `STILLFIRE_FROM` secret on the function. Default is `Stillfire Sauna Co. <bookings@stillfiresaunaco.com>`.

## What was tested

`supabase/schema.sql` was run against a local Postgres with stand-ins for Supabase's auth, scheduler and HTTP extensions. Overlapping, enclosed and blocked-date requests were refused; declined dates reopened; visitors could not read tables or internal functions; non-admin sign-ins saw nothing; reminders, follow-ups and the daily summary queued as expected. The website was clicked through in a browser in preview mode. **Not yet tested:** anything against the real Supabase project, real email delivery, and owner sign-in.
