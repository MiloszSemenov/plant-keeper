import nodemailer from "nodemailer";
import { isResendConfigured, isSmtpConfigured, requireEnv } from "@/lib/env";
import { formatDate } from "@/lib/time";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASSWORD")
    }
  });
}

async function sendWithResend(payload: EmailPayload) {
  if (!isResendConfigured()) {
    return null;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`
    },
    body: JSON.stringify({
      from: requireEnv("EMAIL_FROM"),
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend delivery failed: ${text || response.statusText}`);
  }

  return {
    delivered: true,
    provider: "resend"
  };
}

export async function sendEmail(payload: EmailPayload) {
  const resendDelivery = await sendWithResend(payload);

  if (resendDelivery) {
    return resendDelivery;
  }

  const transporter = getTransporter();

  if (!transporter) {
    console.info("Email provider is not configured. Email payload:", payload);
    return {
      delivered: false,
      reason: "email_not_configured"
    };
  }

  await transporter.sendMail({
    from: requireEnv("EMAIL_FROM"),
    ...payload
  });

  return {
    delivered: true
  };
}

export async function sendWateringReminderEmail({
  to,
  recipientName,
  plants
}: {
  to: string;
  recipientName?: string | null;
  plants: Array<{
    nickname: string;
    speciesName: string;
    vaultName: string;
    nextWateringAt: Date;
  }>;
}) {
  const introName = recipientName?.split(" ")[0] ?? "there";
  const items = plants
    .map(
      (plant) =>
        `<li><strong>${plant.nickname}</strong> (${plant.speciesName}) in ${plant.vaultName} - due ${formatDate(
          plant.nextWateringAt
        )}</li>`
    )
    .join("");

  return sendEmail({
    to,
    subject: "Plants ready for watering today",
    html: `<p>Hi ${introName},</p><p>These plants need water today:</p><ul>${items}</ul><p>Open Plant Keeper to mark them as watered.</p>`,
    text: `Hi ${introName},

These plants need water today:
${plants
  .map(
    (plant) =>
      `- ${plant.nickname} (${plant.speciesName}) in ${plant.vaultName} - due ${formatDate(
        plant.nextWateringAt
      )}`
  )
  .join("\n")}

Open Plant Keeper to mark them as watered.`
  });
}

export async function sendVaultInviteEmail({
  to,
  vaultName,
  inviteUrl,
  inviterName
}: {
  to: string;
  vaultName: string;
  inviteUrl: string;
  inviterName?: string | null;
}) {
  return sendEmail({
    to,
    subject: `Join the ${vaultName} space in Plant Keeper`,
    html: `<p>${inviterName ?? "A Plant Keeper user"} invited you to join <strong>${vaultName}</strong>.</p><p><a href="${inviteUrl}">Accept the invite</a></p>`,
    text: `${inviterName ?? "A Plant Keeper user"} invited you to join "${vaultName}" in Plant Keeper.\n\nAccept the invite: ${inviteUrl}`
  });
}
