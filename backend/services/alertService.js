const nodemailer = require("nodemailer");

function isEnabled() {
  return String(process.env.ALERT_EMAIL_ENABLED || "false").toLowerCase() === "true";
}

function getConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.ALERT_FROM || process.env.SMTP_USER,
    to: process.env.ALERT_TO
  };
}

async function sendAlert(subject, message) {
  if (!isEnabled()) return { sent: false, reason: "ALERT_EMAIL_ENABLED=false" };
  const cfg = getConfig();
  if (!cfg.host || !cfg.user || !cfg.pass || !cfg.to || !cfg.from) {
    throw new Error("Email alert config is incomplete");
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass }
  });

  await transporter.sendMail({
    from: cfg.from,
    to: cfg.to,
    subject,
    text: message
  });

  return { sent: true };
}

module.exports = {
  sendAlert
};
