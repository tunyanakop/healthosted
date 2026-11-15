import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { firstIssue, registerSchema } from "@/lib/validation";
import { createSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const ip = clientIp(req);
  const limit = rateLimit(`register:${ip}`, 5, 10 * 60 * 1000);
  if (!limit.ok) {
    return jsonError("Слишком много попыток, попробуй позже", 429, {
      retryAfterSec: limit.retryAfterSec,
    });
  }

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const existing = await prisma.user.count();
  if (existing > 0) {
    return jsonError("Регистрация закрыта: аккаунт уже создан", 403);
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        name: parsed.data.name?.trim() || null,
        role: "owner",
      },
    });
  } catch {
    // гонка двух одновременных регистраций / дубль email
    return jsonError("Аккаунт уже существует", 409);
  }

  await createSession(user.id, {
    userAgent: req.headers.get("user-agent"),
    ip,
  });
  await audit(user.id, "register", "user", user.id, ip);

  return Response.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { status: 201 },
  );
}
