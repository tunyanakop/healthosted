import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, sameOrigin } from "@/lib/http";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const { id } = await params;
  const existing = await prisma.measurement.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return jsonError("Запись не найдена", 404);

  await prisma.measurement.delete({ where: { id } });
  await audit(user.id, "delete", "measurement", id, clientIp(req));

  return Response.json({ ok: true });
}
