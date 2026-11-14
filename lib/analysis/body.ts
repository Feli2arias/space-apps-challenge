/**
 * Reads a small JSON request body without trusting its size.
 * A body that announces itself as too large is refused before it is read.
 */
export type JsonBody = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBody> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false };

  const text = await request.text();
  if (text.length > maxBytes) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}
