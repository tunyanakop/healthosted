import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { firstIssue, profileSchema } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);
  return Response.json({ user });
}

export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const { name, birthDate, sex, bloodType } = parsed.data;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: name ?? null,
      birthDate: birthDate ? new Date(`${birthDate}T00:00:00.000Z`) : null,
      sex: sex ?? null,
      bloodType: bloodType ?? null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      birthDate: true,
      sex: true,
      bloodType: true,
      role: true,
    },
  });

  await audit(user.id, "update", "user", user.id, clientIp(req));

  return Response.json({ user: updated });
}
