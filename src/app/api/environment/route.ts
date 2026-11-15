import { prisma } from "@/lib/db";
import { jsonError, readJson, sameOrigin } from "@/lib/http";
import { firstIssue, envSettingsSchema } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";
import { getEnvironment } from "@/lib/environment";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  if (user.latitude == null || user.longitude == null) {
    return jsonError("Локация не задана", 400);
  }

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  if (refresh) {
    const limit = rateLimit(`env:${user.id}`, 6, 5 * 60 * 1000);
    if (!limit.ok) {
      return jsonError("Слишком частое обновление, подожди пару минут", 429, {
        retryAfterSec: limit.retryAfterSec,
      });
    }
  }

  const result = await getEnvironment(user.latitude, user.longitude, { force: refresh });
  if (!result) return jsonError("Источник данных недоступен", 503);

  return Response.json(result);
}

export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = envSettingsSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      locationName: parsed.data.locationName ?? null,
      envEnabled: parsed.data.envEnabled,
      incidence: parsed.data.incidence ?? null,
    },
    select: {
      latitude: true,
      longitude: true,
      locationName: true,
      envEnabled: true,
      incidence: true,
    },
  });

  return Response.json({ settings: updated });
}
