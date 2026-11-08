/** Normalizes an Israeli phone number to 05XXXXXXXX / 0XXXXXXXX. Returns null if invalid. */
export function normalizeIsraeliPhone(input: string): string | null {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.startsWith("972")) digits = "0" + digits.slice(3);
  if (/^05\d{8}$/.test(digits)) return digits;
  if (/^0(7\d|[2-489])\d{7}$/.test(digits)) return digits;
  return null;
}

export function cleanText(input: unknown, max: number): string {
  return String(input ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function isUuidLike(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f-]{16,64}$/i.test(s);
}
