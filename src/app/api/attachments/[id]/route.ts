import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, sameOrigin } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { deleteUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const { id } = await params;
  const attachment = await prisma.attachment.findFirst({
    where: { id, userId: user.id },
  });
  if (!attachment) return jsonError("Файл не найден", 404);

  await prisma.attachment.delete({ where: { id } });
  await deleteUpload(attachment.storedPath);
  await audit(user.id, "delete", "attachment", id, clientIp(req));

  return Response.json({ ok: true });
}
