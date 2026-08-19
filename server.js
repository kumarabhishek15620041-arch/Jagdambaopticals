// Jagdamba Opticals — Booking Backend
// Receives appointment requests from the website form and delivers them
// by Email (Gmail) and WhatsApp (Twilio), plus keeps a local JSON log.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BOOKINGS_FILE = path.join(__dirname, 'bookings.json');
const VISITS_FILE = path.join(__dirname, 'visits.json');
const LEADS_FILE = path.join(__dirname, 'leads.json');

// ---------- storage helpers ----------
function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Failed to read ${file}:`, err);
    return [];
  }
}

function appendJSON(file, entry) {
  const items = readJSON(file);
  items.push(entry);
  fs.writeFileSync(file, JSON.stringify(items, null, 2));
  return items;
}

function readBookings() { return readJSON(BOOKINGS_FILE); }
function saveBooking(entry) { appendJSON(BOOKINGS_FILE, entry); }

// ---------- email (Gmail via Nodemailer) ----------
// Requires a Gmail App Password (not your normal password).
// See README.md for setup steps.
let mailTransport = null;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
} else {
  console.warn('[email] GMAIL_USER / GMAIL_APP_PASSWORD not set — email delivery disabled.');
}

async function sendBookingEmail(booking) {
  if (!mailTransport) return { skipped: true };

  const html = `
    <h2>New Appointment Request — Jagdamba Opticals</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><strong>Name</strong></td><td>${escapeHtml(booking.fname)}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${escapeHtml(booking.fphone)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(booking.femail || '—')}</td></tr>
      <tr><td><strong>Service</strong></td><td>${escapeHtml(booking.fservice)}</td></tr>
      <tr><td><strong>Preferred Date</strong></td><td>${escapeHtml(booking.fdate)}</td></tr>
      <tr><td><strong>Notes</strong></td><td>${escapeHtml(booking.fnote || '—')}</td></tr>
      <tr><td><strong>Submitted</strong></td><td>${booking.submittedAt}</td></tr>
    </table>
  `;

  return mailTransport.sendMail({
    from: `"Jagdamba Opticals Website" <${process.env.GMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL || process.env.GMAIL_USER,
    subject: `New Booking Request — ${booking.fname} (${booking.fservice})`,
    html,
  });
}

// ---------- WhatsApp (Twilio) ----------
// Requires a Twilio account with WhatsApp enabled (sandbox for testing,
// an approved WhatsApp sender for production). See README.md for setup.
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  console.warn('[whatsapp] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set — WhatsApp delivery disabled.');
}

async function sendBookingWhatsApp(booking) {
  if (!twilioClient) return { skipped: true };
  if (!process.env.TWILIO_WHATSAPP_FROM || !process.env.NOTIFY_WHATSAPP_TO) {
    console.warn('[whatsapp] TWILIO_WHATSAPP_FROM / NOTIFY_WHATSAPP_TO not set — skipping.');
    return { skipped: true };
  }

  const body =
    `*New Booking Request — Jagdamba Opticals*\n` +
    `Name: ${booking.fname}\n` +
    `Phone: ${booking.fphone}\n` +
    `Service: ${booking.fservice}\n` +
    `Preferred Date: ${booking.fdate}\n` +
    (booking.fnote ? `Notes: ${booking.fnote}\n` : '') +
    `Submitted: ${booking.submittedAt}`;

  return twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${process.env.NOTIFY_WHATSAPP_TO}`,
    body,
  });
}

// ---------- lead notifications (popup form: just name + phone) ----------
async function sendLeadEmail(lead) {
  if (!mailTransport) return { skipped: true };
  const html = `
    <h2>New Website Lead — Jagdamba Opticals</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><strong>Name</strong></td><td>${escapeHtml(lead.name)}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${escapeHtml(lead.phone)}</td></tr>
      <tr><td><strong>Page</strong></td><td>${escapeHtml(lead.page || '—')}</td></tr>
      <tr><td><strong>Submitted</strong></td><td>${lead.submittedAt}</td></tr>
    </table>
  `;
  return mailTransport.sendMail({
    from: `"Jagdamba Opticals Website" <${process.env.GMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL || process.env.GMAIL_USER,
    subject: `New Website Lead — ${lead.name}`,
    html,
  });
}

async function sendLeadWhatsApp(lead) {
  if (!twilioClient) return { skipped: true };
  if (!process.env.TWILIO_WHATSAPP_FROM || !process.env.NOTIFY_WHATSAPP_TO) return { skipped: true };
  const body =
    `*New Website Lead — Jagdamba Opticals*\n` +
    `Name: ${lead.name}\n` +
    `Phone: ${lead.phone}\n` +
    `Submitted: ${lead.submittedAt}`;
  return twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${process.env.NOTIFY_WHATSAPP_TO}`,
    body,
  });
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- routes ----------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    emailEnabled: Boolean(mailTransport),
    whatsappEnabled: Boolean(twilioClient),
  });
});

app.post('/api/bookings', async (req, res) => {
  const { fname, fphone, femail, fservice, fdate, fnote } = req.body || {};

  if (!fname || !fphone || !fservice || !fdate) {
    return res.status(400).json({ ok: false, error: 'Missing required fields.' });
  }

  const booking = {
    fname,
    fphone,
    femail: femail || '',
    fservice,
    fdate,
    fnote: fnote || '',
    submittedAt: new Date().toISOString(),
  };

  saveBooking(booking);

  const results = await Promise.allSettled([
    sendBookingEmail(booking),
    sendBookingWhatsApp(booking),
  ]);

  results.forEach((r, i) => {
    const label = i === 0 ? 'email' : 'whatsapp';
    if (r.status === 'rejected') {
      console.error(`[${label}] delivery failed:`, r.reason?.message || r.reason);
    }
  });

  res.json({ ok: true, message: 'Booking received.' });
});

// ---------- visitor tracking ----------
// Called once per page load from the website (see script in jagdamba-opticals.html).
app.post('/api/visits', (req, res) => {
  const { page, referrer, screen } = req.body || {};
  const visit = {
    page: page || '/',
    referrer: referrer || '',
    screen: screen || '',
    ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(),
    userAgent: req.headers['user-agent'] || '',
    at: new Date().toISOString(),
  };
  appendJSON(VISITS_FILE, visit);
  res.json({ ok: true });
});

// ---------- popup lead capture (name + phone, no full booking) ----------
app.post('/api/leads', async (req, res) => {
  const { name, phone, page } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ ok: false, error: 'Name and phone are required.' });
  }
  const lead = { name, phone, page: page || '', submittedAt: new Date().toISOString() };
  appendJSON(LEADS_FILE, lead);

  const results = await Promise.allSettled([sendLeadEmail(lead), sendLeadWhatsApp(lead)]);
  results.forEach((r, i) => {
    const label = i === 0 ? 'email' : 'whatsapp';
    if (r.status === 'rejected') console.error(`[lead:${label}] delivery failed:`, r.reason?.message || r.reason);
  });

  res.json({ ok: true });
});

// ---------- admin routes (protected with a simple shared key) ----------
// Pass ?key=YOUR_ADMIN_KEY, matching ADMIN_KEY in .env. Set a strong,
// random ADMIN_KEY before deploying — these routes expose visitor data.
function requireAdminKey(req, res, next) {
  const key = req.query.key || req.headers['x-admin-key'];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

app.get('/api/bookings', requireAdminKey, (req, res) => {
  res.json(readBookings());
});

app.get('/api/leads', requireAdminKey, (req, res) => {
  res.json(readJSON(LEADS_FILE));
});

app.get('/api/visits', requireAdminKey, (req, res) => {
  res.json(readJSON(VISITS_FILE));
});

app.get('/api/analytics', requireAdminKey, (req, res) => {
  const visits = readJSON(VISITS_FILE);
  const leads = readJSON(LEADS_FILE);
  const bookings = readBookings();

  const byDay = {};
  visits.forEach((v) => {
    const day = (v.at || '').slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });

  res.json({
    totalVisits: visits.length,
    totalLeads: leads.length,
    totalBookings: bookings.length,
    visitsByDay: byDay,
  });
});

app.listen(PORT, () => {
  console.log(`Jagdamba Opticals backend running on http://localhost:${PORT}`);
});