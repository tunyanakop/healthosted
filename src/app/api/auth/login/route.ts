import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { firstIssue, loginSchema } from "@/lib/validation";
import { createSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const ip = clientIp(req);
  const ipLimit = rateLimit(`login:ip:${ip}`, 15, 10 * 60 * 1000);
  if (!ipLimit.ok) {
    return jsonError("Слишком много попыток входа, попробуй позже", 429, {
      retryAfterSec: ipLimit.retryAfterSec,
    });
  }

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const { email, password } = parsed.data;

  const emailLimit = rateLimit(`login:email:${email}`, 8, 10 * 60 * 1000);
  if (!emailLimit.ok) {
    return jsonError("Слишком много попыток для этого аккаунта", 429, {
      retryAfterSec: emailLimit.retryAfterSec,
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !ok) {
    await audit(user?.id ?? null, "login_failed", "user", user?.id, ip);
    return jsonError("Неверный email или пароль", 401);
  }

  await createSession(user.id, {
    userAgent: req.headers.get("user-agent"),
    ip,
  });
  await audit(user.id, "login", "user", user.id, ip);

  return Response.json({ user: { id: user.id, email: user.email, name: user.name } });
}
