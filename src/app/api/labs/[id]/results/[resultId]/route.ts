import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, sameOrigin } from "@/lib/http";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; resultId: string }> },
) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const { id, resultId } = await params;
  const panel = await prisma.labPanel.findFirst({ where: { id, userId: user.id } });
  if (!panel) return jsonError("Панель не найдена", 404);

  const result = await prisma.labResult.findFirst({ where: { id: resultId, panelId: id } });
  if (!result) return jsonError("Показатель не найден", 404);

  await prisma.labResult.delete({ where: { id: resultId } });
  await audit(user.id, "delete", "labResult", resultId, clientIp(req));

  return Response.json({ ok: true });
}
