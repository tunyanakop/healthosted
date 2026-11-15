import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { firstIssue, labPanelSchema } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const items = await prisma.labPanel.findMany({
    where: { userId: user.id },
    orderBy: { takenAt: "desc" },
    include: {
      results: { orderBy: { name: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  return Response.json({ items });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = labPanelSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const item = await prisma.labPanel.create({
    data: {
      userId: user.id,
      takenAt: new Date(`${parsed.data.takenAt}T00:00:00.000Z`),
      kind: parsed.data.kind ?? null,
      specimen: parsed.data.specimen ?? null,
      pregnant: parsed.data.pregnant ?? null,
      trimester: parsed.data.trimester ?? null,
      menopause: parsed.data.menopause ?? null,
      cyclePhase: parsed.data.cyclePhase ?? null,
      labName: parsed.data.labName ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  await audit(user.id, "create", "labPanel", item.id, clientIp(req));
  return Response.json({ item }, { status: 201 });
}
