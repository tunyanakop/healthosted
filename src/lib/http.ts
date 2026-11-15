export function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "local"
  );
}

/** Разбор JSON: undefined — тело битое или отсутствует. */
export async function readJson(req: Request): Promise<unknown | undefined> {
  try {
    const data = await req.json();
    if (data === null || typeof data !== "object") return undefined;
    return data;
  } catch {
    return undefined;
  }
}
