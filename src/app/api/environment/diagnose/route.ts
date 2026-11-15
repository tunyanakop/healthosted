import { jsonError } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { diagnoseProviders } from "@/lib/environment";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  if (user.latitude == null || user.longitude == null) {
    return jsonError("Сначала укажи локацию", 400);
  }

  const limit = rateLimit(`diag:${user.id}`, 4, 5 * 60 * 1000);
  if (!limit.ok) {
    return jsonError("Диагностика уже запускалась, подожди пару минут", 429, {
      retryAfterSec: limit.retryAfterSec,
    });
  }

  const results = await diagnoseProviders(user.latitude, user.longitude);

  return Response.json({
    coords: { lat: user.latitude, lon: user.longitude, name: user.locationName },
    results,
  });
}
