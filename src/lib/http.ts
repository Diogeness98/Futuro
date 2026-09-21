export async function bodyFromRequest(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return (await request.json()) as Record<string, unknown>;

  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export function moneyToCents(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const normalized = String(value ?? "0").trim().replace(".", "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function integer(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
