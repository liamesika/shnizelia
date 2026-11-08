/** ₪55 — no decimals when whole, two decimals otherwise. */
export function formatILS(agorot: number): string {
  const shekels = agorot / 100;
  const text = Number.isInteger(shekels) ? String(shekels) : shekels.toFixed(2);
  return `₪${text}`;
}

export function shekelsToAgorot(input: string | number): number | null {
  const n = typeof input === "number" ? input : Number(String(input).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
