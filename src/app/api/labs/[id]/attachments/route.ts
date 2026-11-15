import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, sameOrigin } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import {
  MAX_FILE_BYTES,
  displayName,
  isAllowedMime,
  saveUpload,
  deleteUpload,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const { id } = await params;
  const panel = await prisma.labPanel.findFirst({ where: { id, userId: user.id } });
  if (!panel) return jsonError("Панель не найдена", 404);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError("Файл не передан", 400);

  if (!isAllowedMime(file.type)) {
    return jsonError("Разрешены только PDF, JPG, PNG, WEBP", 415);
  }
  if (file.size > MAX_FILE_BYTES) {
    return jsonError("Файл больше 25 МБ", 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await saveUpload(buffer, file.type, user.id);

  try {
    const attachment = await prisma.attachment.create({
      data: {
        userId: user.id,
        labPanelId: id,
        filename: displayName(file.name),
        mime: stored.mime,
        size: stored.size,
        sha256: stored.sha256,
        storedPath: stored.storedPath,
      },
    });

    await audit(user.id, "create", "attachment", attachment.id, clientIp(req));
    return Response.json({ attachment }, { status: 201 });
  } catch (error) {
    await deleteUpload(stored.storedPath);
    throw error;
  }
}
