# Jagdamba Opticals — Booking Backend

A small Node.js/Express server that receives appointment requests from the
website's booking form and sends them to you by **Email (Gmail)** and
**WhatsApp (Twilio)**. Every request is also saved to `bookings.json` as a
simple backup log.

## 1. Install

You'll need [Node.js](https://nodejs.org) 18+ installed.

```bash
cd jagdamba-backend
npm install
```

## 2. Configure credentials

```bash
cp .env.example .env
```

Then open `.env` and fill in:

### Email (Gmail)
1. Turn on 2-Step Verification on the Gmail account: https://myaccount.google.com/security
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Put the Gmail address in `GMAIL_USER` and the 16-character app password in `GMAIL_APP_PASSWORD`.
4. `NOTIFY_EMAIL` is where booking alerts land — set it to `Jagdambaopticals@gmail.com`.

### WhatsApp (Twilio)
1. Create a free account at https://www.twilio.com/try-twilio
2. In the Twilio Console, open **Messaging → Try it out → Send a WhatsApp message** to activate the sandbox, and follow the "join" instructions from the shop's WhatsApp number.
3. Copy your **Account SID** and **Auth Token** from the Twilio Console dashboard into `.env`.
4. `TWILIO_WHATSAPP_FROM` is the Twilio sandbox number (`+14155238886` by default).
5. `NOTIFY_WHATSAPP_TO` is the shop's WhatsApp number, e.g. `+919650615846`.
6. For production (not just testing), apply for an approved WhatsApp Business sender: https://www.twilio.com/whatsapp — the sandbox only works with numbers that have joined it.

Both integrations are optional and independent — if you only fill in the
email variables, WhatsApp sending is simply skipped (and vice versa), so you
can turn this on gradually.

## 3. Run it

```bash
npm start
```

The server starts on `http://localhost:3000` (or the `PORT` you set).

Check it's alive:
```bash
curl http://localhost:3000/api/health
```

## 4. Point the website at it

`jagdamba-opticals.html` is already wired to call this backend. Near the
bottom of the file, find this line:

```js
const API_URL = 'https://your-backend-domain.com/api/bookings';
```

Replace it with wherever you deploy this server, e.g.:

```js
const API_URL = 'https://api.jagdambaopticals.com/api/bookings';
```

## 5. Deploy

Any Node host works — a few simple options:
- **Render** (render.com) — free tier, connects to a GitHub repo, set env vars in dashboard
- **Railway** (railway.app) — similar, very quick to deploy
- **A VPS** (e.g. DigitalOcean) — run with `pm2 start server.js` to keep it alive

Whichever you choose, set the same variables from `.env` in that host's
environment settings — never upload the `.env` file itself.

## 6. Visitor tracking & the "call back" popup

Two extra pieces are already wired into the website:

- **Visit tracking** — every page load silently pings `/api/visits`, logging
  the page, referrer, screen size, IP and time.
- **Lead popup** — a card asking for name + phone appears once per visit
  (after 12 seconds, or when someone scrolls past 60% of the page). Submissions
  go to `/api/leads`, saved to `leads.json`, and — just like bookings — sent to
  you by email and WhatsApp.

### Viewing the data

All admin routes require an `ADMIN_KEY` (set it in `.env` first — see
`.env.example`). Once your server is running, open these in a browser or
`curl`, appending `?key=YOUR_ADMIN_KEY`:

```
GET /api/analytics?key=YOUR_ADMIN_KEY   → { totalVisits, totalLeads, totalBookings, visitsByDay }
GET /api/visits?key=YOUR_ADMIN_KEY      → full visit log
GET /api/leads?key=YOUR_ADMIN_KEY       → full lead log
GET /api/bookings?key=YOUR_ADMIN_KEY    → full booking log
```

Example:
```bash
curl "https://your-backend-domain.com/api/analytics?key=YOUR_ADMIN_KEY"
```

## 7. Before going live

- Set a strong, random `ADMIN_KEY` in `.env` — without it, the admin routes
  above are locked out entirely (safe default, but you won't see any data
  until it's set).
- Consider adding basic spam protection (e.g. a honeypot field or rate
  limiting) since both the booking and lead forms are public.
- Test both delivery channels with a real submission before relying on them.

## Files

| File | Purpose |
|---|---|
| `server.js` | Express server — bookings, leads, visit tracking, email + WhatsApp sending |
| `package.json` | Dependencies |
| `.env.example` | Credential template — copy to `.env` |
| `bookings.json` | Auto-created log of appointment requests |
| `leads.json` | Auto-created log of popup "call back" submissions |
| `visits.json` | Auto-created log of page visits |
