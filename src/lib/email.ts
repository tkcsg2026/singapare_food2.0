import nodemailer from "nodemailer";

const CONTACT_TO = process.env.CONTACT_EMAIL_TO || "tkcsg2026@gmail.com";
/** Contact form emails are always sent to CONTACT_TO and also forwarded here. */
const CONTACT_FORWARD_TO = "tkcsg2026@gmail.com";
const ADMIN_NOTIFY_FROM = process.env.ADMIN_NOTIFY_FROM || "tkcsg2026@gmail.com";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendContactEmail(data: {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  productsServices?: string;
  companyAddress?: string;
  websiteUrl?: string;
  inquiryMessage?: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  const {
    companyName,
    contactName,
    email,
    phone,
    productsServices,
    companyAddress,
    websiteUrl,
    inquiryMessage,
  } = data;

  const optionalLines: string[] = [];
  if (productsServices?.trim()) optionalLines.push(`Products / services: ${productsServices.trim()}`);
  if (companyAddress?.trim()) optionalLines.push(`Company address: ${companyAddress.trim()}`);
  if (websiteUrl?.trim()) optionalLines.push(`Website: ${websiteUrl.trim()}`);
  if (inquiryMessage?.trim()) optionalLines.push(`Inquiry / message:\n${inquiryMessage.trim()}`);

  const textBody = [
    `Company: ${companyName}`,
    `Contact person: ${contactName}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    ...(optionalLines.length ? ["", ...optionalLines] : []),
  ].join("\n");

  const htmlOptional: string[] = [];
  if (productsServices?.trim()) {
    htmlOptional.push(`<p><strong>Products / services:</strong> ${escapeHtml(productsServices.trim())}</p>`);
  }
  if (companyAddress?.trim()) {
    htmlOptional.push(`<p><strong>Company address:</strong> ${escapeHtml(companyAddress.trim())}</p>`);
  }
  if (websiteUrl?.trim()) {
    const u = escapeHtml(websiteUrl.trim());
    htmlOptional.push(`<p><strong>Website:</strong> <a href="${u}">${u}</a></p>`);
  }
  if (inquiryMessage?.trim()) {
    htmlOptional.push(
      `<p><strong>Inquiry / message:</strong><br/>${escapeHtml(inquiryMessage.trim()).replace(/\n/g, "<br/>")}</p>`
    );
  }

  const subjectLine = `[Contact Form] Listing inquiry — ${companyName}`;

  // Send to primary recipient and always forward a copy to tkcsg2026@gmail.com
  const toAddresses = [...new Set([CONTACT_TO, CONTACT_FORWARD_TO])];

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toAddresses,
    replyTo: email,
    subject: subjectLine,
    text: textBody,
    html: [
      `<p><strong>Company:</strong> ${escapeHtml(companyName)}</p>`,
      `<p><strong>Contact person:</strong> ${escapeHtml(contactName)}</p>`,
      `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`,
      `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>`,
      ...(htmlOptional.length ? [`<hr/>`, ...htmlOptional] : []),
    ].join("\n"),
  });

  return true;
}

export async function sendAdminActionEmail(data: {
  action: "ban" | "unban" | "delete";
  userName: string;
  userEmail: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  const { action, userName, userEmail } = data;

  const subjects: Record<typeof action, string> = {
    ban: "Your account has been suspended",
    unban: "Your account has been reinstated",
    delete: "Your account has been deleted",
  };

  const bodies: Record<typeof action, string> = {
    ban: `Dear ${escapeHtml(userName)},<br/><br/>Your account on Singapore F&amp;B Portal has been <strong>suspended</strong> by an administrator.<br/>If you believe this is a mistake, please contact us.`,
    unban: `Dear ${escapeHtml(userName)},<br/><br/>Your account on Singapore F&amp;B Portal has been <strong>reinstated</strong>. You may log in again.`,
    delete: `Dear ${escapeHtml(userName)},<br/><br/>Your account on Singapore F&amp;B Portal has been <strong>permanently deleted</strong> by an administrator.<br/>If you believe this is a mistake, please contact us.`,
  };

  await transporter.sendMail({
    from: ADMIN_NOTIFY_FROM,
    to: userEmail,
    subject: subjects[action],
    html: `<p>${bodies[action]}</p>`,
    text: bodies[action].replace(/<[^>]+>/g, ""),
  });

  return true;
}

export async function sendNewListingNotification(data: {
  title: string;
  sellerName: string;
  price: number;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  const { title, sellerName, price } = data;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: CONTACT_FORWARD_TO,
    subject: `[商品承認待ち] ${title}`,
    html: [
      `<p>新しい売り&amp;買い出品が承認待ちです。</p>`,
      `<p><strong>商品名:</strong> ${escapeHtml(title)}</p>`,
      `<p><strong>出品者:</strong> ${escapeHtml(sellerName)}</p>`,
      `<p><strong>価格:</strong> S$${price}</p>`,
      `<p><a href="https://thekitchenconnection.net/admin">管理ダッシュボードで確認する →</a></p>`,
    ].join("\n"),
    text: `新しい売り&買い出品が承認待ちです。\n商品名: ${title}\n出品者: ${sellerName}\n価格: S$${price}\n管理ダッシュボード: https://thekitchenconnection.net/admin`,
  });

  return true;
}

export async function sendMarketplaceRejectionEmail(data: {
  userEmail: string;
  userName: string;
  itemTitle: string;
  rejectReason: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  const { userEmail, userName, itemTitle, rejectReason } = data;

  await transporter.sendMail({
    from: ADMIN_NOTIFY_FROM,
    to: userEmail,
    subject: `Your listing "${itemTitle}" has been rejected`,
    html: [
      `<p>Dear ${escapeHtml(userName)},</p>`,
      `<p>Your listing <strong>${escapeHtml(itemTitle)}</strong> on The Kitchen Connection has been <strong>rejected</strong>.</p>`,
      rejectReason ? `<p><strong>Reason:</strong> ${escapeHtml(rejectReason)}</p>` : "",
      `<p>If you have any questions, please contact us.</p>`,
    ].join("\n"),
    text: `Dear ${userName},\n\nYour listing "${itemTitle}" has been rejected.\n${rejectReason ? `Reason: ${rejectReason}\n` : ""}\nIf you have any questions, please contact us.`,
  });

  return true;
}

export async function sendReportNotification(data: {
  itemId: string;
  reason: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  const { itemId, reason } = data;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: CONTACT_FORWARD_TO,
    subject: `[商品報告] 商品ID: ${itemId}`,
    html: [
      `<p>商品に対する報告が届きました。</p>`,
      `<p><strong>商品ID:</strong> ${escapeHtml(itemId)}</p>`,
      `<p><strong>報告理由:</strong> ${escapeHtml(reason)}</p>`,
      `<p><a href="https://thekitchenconnection.net/admin">管理ダッシュボードで確認する →</a></p>`,
    ].join("\n"),
    text: `商品報告\n商品ID: ${itemId}\n報告理由: ${reason}\n管理ダッシュボード: https://thekitchenconnection.net/admin`,
  });

  return true;
}

export async function sendPasswordResetEmail(data: {
  userEmail: string;
  resetLink: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  const { userEmail, resetLink } = data;

  await transporter.sendMail({
    from: `"The Kitchen Connection" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: userEmail,
    subject: "Reset your password",
    html: [
      `<p>Hello,</p>`,
      `<p>Click the link below to reset your password. This link expires in 1 hour.</p>`,
      `<p><a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#e11d48;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Reset Password</a></p>`,
      `<p>If you did not request a password reset, you can safely ignore this email.</p>`,
      `<p style="color:#999;font-size:12px;">The Kitchen Connection</p>`,
    ].join("\n"),
    text: `Reset your password\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
  });

  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
