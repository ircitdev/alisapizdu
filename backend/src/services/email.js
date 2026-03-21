const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log(`[${new Date().toISOString()}] SMTP not configured, email notifications disabled`);
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  console.log(`[${new Date().toISOString()}] SMTP configured: ${user}@${host}:${port}`);
  return transporter;
}

async function sendInviteNotification({ to, presetName, senderName, device, os, city, country, datetime, userMessage, aliceResponse, messageId }) {
  const t = getTransporter();
  if (!t) return;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const siteUrl = 'https://xn--80aaaqjgddaqi2bmfw7b.xn--p1ai';

  const locationParts = [city, country].filter(Boolean).join(', ');
  const deviceParts = [device, os].filter(Boolean).join(', ');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0f0f1a;color:#e0d0ff;font-family:Arial,sans-serif;padding:24px;">
  <div style="max-width:500px;margin:0 auto;background:#1e1e3a;border-radius:12px;padding:24px;border:1px solid rgba(123,104,238,0.3);">
    <h2 style="color:#7B68EE;margin:0 0 16px;">Ваша ссылка сработала!</h2>
    <p style="margin:0 0 16px;color:#e0d0ff;">Кто-то перешёл по вашей ссылке и спросил Алису.</p>

    <table style="width:100%;color:#e0d0ff;font-size:14px;margin-bottom:16px;">
      <tr><td style="padding:4px 8px;color:#7B68EE;">Имя:</td><td style="padding:4px 8px;">${escapeHtml(senderName || presetName)}</td></tr>
      ${deviceParts ? `<tr><td style="padding:4px 8px;color:#7B68EE;">Устройство:</td><td style="padding:4px 8px;">${escapeHtml(deviceParts)}</td></tr>` : ''}
      ${locationParts ? `<tr><td style="padding:4px 8px;color:#7B68EE;">Город:</td><td style="padding:4px 8px;">${escapeHtml(locationParts)}</td></tr>` : ''}
      <tr><td style="padding:4px 8px;color:#7B68EE;">Время:</td><td style="padding:4px 8px;">${escapeHtml(datetime)}</td></tr>
    </table>

    <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-bottom:12px;">
      <div style="color:#7B68EE;font-size:12px;margin-bottom:4px;">Сообщение:</div>
      <div style="color:#fff;font-size:15px;">${escapeHtml(userMessage)}</div>
    </div>

    <div style="background:rgba(123,104,238,0.1);border-radius:8px;padding:12px;margin-bottom:16px;">
      <div style="color:#7B68EE;font-size:12px;margin-bottom:4px;">Ответ Алисы:</div>
      <div style="color:#e0d0ff;font-size:15px;">${escapeHtml(aliceResponse)}</div>
    </div>

    <a href="${siteUrl}/#msg-${messageId}"
       style="display:inline-block;background:#7B68EE;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;">
      Посмотреть в ленте
    </a>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:20px 0 12px;">
    <div style="color:rgba(255,255,255,0.3);font-size:11px;">
      алисапокажипизду.рф — Экспериментальная платформа изучения поведения нейросетей
    </div>
  </div>
</body>
</html>`;

  try {
    await t.sendMail({
      from,
      to,
      subject: `Ваша ссылка сработала! ${presetName} спросил Алису`,
      html,
    });
    const [local, domain] = to.split('@');
    const masked = local[0] + '***@' + domain;
    console.log(`[${new Date().toISOString()}] Email sent to ${masked}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Email error: ${err.message}`);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendInviteNotification, getTransporter };
