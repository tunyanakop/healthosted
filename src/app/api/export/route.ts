import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { absolutePath } from "@/lib/storage";
import { createZip, type ZipEntry } from "@/lib/zip";

export const dynamic = "force-dynamic";

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120) || "file";
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const [profile, measurements, conditions, visits, medbook, labPanels] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        birthDate: true,
        sex: true,
        bloodType: true,
        createdAt: true,
      },
    }),
    prisma.measurement.findMany({ where: { userId: user.id }, orderBy: { measuredAt: "asc" } }),
    prisma.condition.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.visit.findMany({
      where: { userId: user.id },
      orderBy: { visitedAt: "asc" },
      include: { attachments: true },
    }),
    prisma.medBookEntry.findMany({ where: { userId: user.id }, include: { attachments: true } }),
    prisma.labPanel.findMany({
      where: { userId: user.id },
      orderBy: { takenAt: "asc" },
      include: { results: true, attachments: true },
    }),
  ]);

  const payload = {
    format: "healtosted-archive",
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    measurements,
    conditions,
    visits,
    medbook,
    labPanels,
  };

  const entries: ZipEntry[] = [
    { name: "data.json", data: Buffer.from(JSON.stringify(payload, null, 2), "utf8") },
    {
      name: "README.txt",
      data: Buffer.from(
        [
          "HealtHosted — экспорт личного медицинского архива",
          `Дата выгрузки: ${new Date().toISOString()}`,
          "",
          "data.json — все записи (измерения, болезни, визиты, медкнижка, анализы).",
          "files/  — прикреплённые PDF и изображения; имя файла: <id>-<оригинальное имя>.",
          "",
          "Файл содержит медицинские данные. Храни его в защищённом месте.",
        ].join("\n"),
        "utf8",
      ),
    },
  ];

  const attachments = [
    ...visits.flatMap((v) => v.attachments),
    ...medbook.flatMap((m) => m.attachments),
    ...labPanels.flatMap((p) => p.attachments),
  ];

  const seen = new Set<string>();
  for (const a of attachments) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    try {
      const data = await readFile(absolutePath(a.storedPath));
      entries.push({ name: `files/${a.id}-${safeName(a.filename)}`, data });
    } catch {
      // файл потерян — пропускаем, но факт остаётся в data.json
    }
  }

  const zip = createZip(entries);
  await audit(user.id, "export", "archive", undefined, clientIp(req));

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-length": String(zip.length),
      "content-disposition": `attachment; filename="healtosted-${stamp}.zip"`,
      "cache-control": "private, no-store",
    },
  });
}
