import { jsonError } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { searchLocation } from "@/lib/environment";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const query = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (query.length < 2) return jsonError("Минимум 2 символа", 422);

  const limit = rateLimit(`geo:${user.id}`, 20, 5 * 60 * 1000);
  if (!limit.ok) {
    return jsonError("Слишком много запросов, подожди минуту", 429, {
      retryAfterSec: limit.retryAfterSec,
    });
  }

  const results = await searchLocation(query);
  return Response.json({ results });
}
