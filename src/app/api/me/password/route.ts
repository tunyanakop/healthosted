import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { firstIssue, passwordChangeSchema } from "@/lib/validation";
import { getSessionUser, revokeOtherSessions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const ip = clientIp(req);
  const limit = rateLimit(`password:${user.id}`, 5, 10 * 60 * 1000);
  if (!limit.ok) {
    return jsonError("Слишком много попыток, попробуй позже", 429, {
      retryAfterSec: limit.retryAfterSec,
    });
  }

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);
  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return jsonError("Пользователь не найден", 404);

  const ok = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!ok) return jsonError("Текущий пароль неверен", 401);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  await revokeOtherSessions(user.id);
  await audit(user.id, "password_change", "user", user.id, ip);

  return Response.json({ ok: true });
}
