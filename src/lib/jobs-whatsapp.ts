/** Digits only for wa.me (e.g. 6581234567). */
export function sanitizeWhatsAppDigits(input: string): string {
  return input.replace(/\D/g, "");
}
