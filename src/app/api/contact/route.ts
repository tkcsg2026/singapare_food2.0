import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { sendContactEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    companyName,
    contactName,
    email,
    phone,
    productsServices,
    companyAddress,
    websiteUrl,
    inquiryMessage,
  } = body;

  if (
    !companyName?.trim() ||
    !contactName?.trim() ||
    !email?.trim() ||
    !phone?.trim()
  ) {
    return NextResponse.json({ error: "Required fields are missing" }, { status: 400 });
  }

  const payload = {
    companyName: String(companyName).trim(),
    contactName: String(contactName).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    productsServices: typeof productsServices === "string" ? productsServices : "",
    companyAddress: typeof companyAddress === "string" ? companyAddress : "",
    websiteUrl: typeof websiteUrl === "string" ? websiteUrl : "",
    inquiryMessage: typeof inquiryMessage === "string" ? inquiryMessage : "",
  };

  const emailSent = await sendContactEmail(payload);
  if (!emailSent) {
    return NextResponse.json(
      { error: "Email service is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS." },
      { status: 503 }
    );
  }

  const supabase = createAdminSupabaseClient();
  if (supabase) {
    try {
      const subject = `Listing inquiry — ${payload.companyName}`;
      const message = [
        `Company: ${payload.companyName}`,
        `Contact: ${payload.contactName}`,
        `Email: ${payload.email}`,
        `Phone: ${payload.phone}`,
        payload.productsServices ? `Products/services: ${payload.productsServices}` : "",
        payload.companyAddress ? `Address: ${payload.companyAddress}` : "",
        payload.websiteUrl ? `Website: ${payload.websiteUrl}` : "",
        payload.inquiryMessage ? `Message:\n${payload.inquiryMessage}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await supabase.from("contact_messages").insert({
        name: `${payload.contactName} (${payload.companyName})`,
        email: payload.email,
        subject,
        message,
      });
    } catch {
      // Table might not exist; email was sent, so we still return success
    }
  }

  return NextResponse.json({ success: true });
}
