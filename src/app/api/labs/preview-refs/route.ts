import { jsonError, readJson, sameOrigin } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { firstIssue, labPreviewSchema } from "@/lib/validation";
import { resolveRangesBatch } from "@/lib/reference";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const limit = rateLimit(`preview:${user.id}`, 60, 5 * 60 * 1000);
  if (!limit.ok) return jsonError("Слишком много запросов, подожди минуту", 429);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = labPreviewSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const data = parsed.data;

  const ranges = await resolveRangesBatch({
    codes: data.codes,
    sex: user.sex,
    birthDate: user.birthDate,
    takenAt: data.takenAt ? new Date(`${data.takenAt}T00:00:00.000Z`) : new Date(),
    specimen: data.specimen ?? null,
    pregnant: data.pregnant ?? null,
    trimester: data.trimester ?? null,
    menopause: data.menopause ?? null,
    cyclePhase: data.cyclePhase ?? null,
  });

  return Response.json({ ranges });
}
