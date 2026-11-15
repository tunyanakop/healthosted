import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { absolutePath } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const { id } = await params;
  const attachment = await prisma.attachment.findFirst({
    where: { id, userId: user.id },
  });
  if (!attachment) return jsonError("Файл не найден", 404);

  let data: Buffer;
  try {
    data = await readFile(absolutePath(attachment.storedPath));
  } catch {
    return jsonError("Файл потерян на диске", 410);
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": attachment.mime,
      "content-length": String(data.length),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
