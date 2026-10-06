import nodemailer from 'nodemailer';

let transporter;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
      port,
      secure: process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === 'true'
        : port === 465,
      auth: {
        user: required('SMTP_USER'),
        pass: required('SMTP_APP_PASSWORD'),
      },
    });
  }
  return transporter;
}

function getSender() {
  return process.env.MAIL_FROM?.trim() || `PROCTR <${required('SMTP_USER')}>`;
}

function getResetUrl(token) {
  const frontendUrl = (process.env.FRONTEND_URL?.trim() || 'http://localhost:5173').replace(/\/$/, '');
  return `${frontendUrl}/?reset_token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail({ to, firstName, token, expiresInMinutes }) {
  const resetUrl = getResetUrl(token);
  const safeName = escapeHtml(firstName || 'user');
  const safeUrl = escapeHtml(resetUrl);
  const requestTime = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  await getTransporter().sendMail({
    from: getSender(),
    to,
    subject: `PROCTR password reset - ${requestTime}`,
    text: `Hello ${firstName || 'user'},\n\nOpen this link to reset your PROCTR password:\n${resetUrl}\n\nThis link expires in ${expiresInMinutes} minutes and can be used only once. If you requested multiple links, only the newest email will work. If you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
        <h2 style="color:#1a2b4b">Reset your PROCTR password</h2>
        <p>Hello ${safeName},</p>
        <p>Use the button below to choose a new password.</p>
        <p style="margin:28px 0">
          <a href="${safeUrl}" style="background:#1a2b4b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">Reset password</a>
        </p>
        <p>This link expires in ${expiresInMinutes} minutes and can be used only once.</p>
        <p><strong>If you requested multiple links, only the newest email will work.</strong></p>
        <p style="font-size:13px;color:#6b7280">If you did not request this reset, ignore this email. Your password has not changed.</p>
      </div>`,
  });
}

export async function sendPasswordChangedEmail({ to, firstName }) {
  await getTransporter().sendMail({
    from: getSender(),
    to,
    subject: 'Your PROCTR password was changed',
    text: `Hello ${firstName || 'user'},\n\nYour PROCTR password was changed successfully. If you did not make this change, contact your university administrator immediately.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
        <h2 style="color:#1a2b4b">Password changed</h2>
        <p>Hello ${escapeHtml(firstName || 'user')},</p>
        <p>Your PROCTR password was changed successfully.</p>
        <p style="font-size:13px;color:#6b7280">If you did not make this change, contact your university administrator immediately.</p>
      </div>`,
  });
}

export async function verifyEmailConnection() {
  await getTransporter().verify();
}
