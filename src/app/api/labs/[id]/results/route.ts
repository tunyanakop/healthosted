import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http";
import { firstIssue, labResultsBulkSchema } from "@/lib/validation";
import { getSessionUser } from "@/lib/session";
import { parseNumeric } from "@/lib/labs";
import { codeForName } from "@/lib/reference-data";
import { flagFromManual, resolveReference, convertToUnit } from "@/lib/reference";
import { evaluateWithPanic, rangesDiffer } from "@/lib/reference-core";

export const dynamic = "force-dynamic";

const norm = (unit: string | null | undefined) =>
  (unit ?? "").trim().toLowerCase().replace(/\s+/g, "");

/** Полная замена набора показателей панели (только заполненные строки). */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req)) return jsonError("Запрос отклонён", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Требуется вход", 401);

  const { id } = await params;
  const panel = await prisma.labPanel.findFirst({ where: { id, userId: user.id } });
  if (!panel) return jsonError("Панель не найдена", 404);

  const body = await readJson(req);
  if (body === undefined) return jsonError("Некорректный JSON", 400);

  const parsed = labResultsBulkSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const filled = parsed.data.results.filter((r) => r.value.trim() !== "");

  const badRange = filled.find(
    (r) => r.refMin != null && r.refMax != null && r.refMin > r.refMax,
  );
  if (badRange) {
    return jsonError(`Верхняя граница меньше нижней: ${badRange.name}`, 422);
  }

  const data = [];

  for (const r of filled) {
    const numericValue = parseNumeric(r.value);
    const testCode = r.code ?? codeForName(r.name, panel.kind);
    const customRange = r.refMin != null || r.refMax != null;

    if (!testCode) {
      data.push({
        panelId: id,
        testCode: null,
        name: r.name,
        value: r.value,
        numericValue,
        unit: r.unit ?? null,
        refMin: r.refMin ?? null,
        refMax: r.refMax ?? null,
        flag: flagFromManual(numericValue, r.refMin ?? null, r.refMax ?? null),
        appliedNote:
          customRange ? "границы заданы вручную" : "нет референса",
      });
      continue;
    }

    const resolution = await resolveReference({
      testCode,
      value: numericValue,
      unit: r.unit ?? null,
      sex: user.sex,
      birthDate: user.birthDate,
      takenAt: panel.takenAt,
      specimen: panel.specimen,
      pregnant: panel.pregnant,
      trimester: panel.trimester,
      menopause: panel.menopause,
      cyclePhase: panel.cyclePhase,
    });

    // целевые единицы: из правила, иначе — как ввёл пользователь
    const targetUnit = resolution.appliedUnit ?? r.unit ?? null;

    let value = numericValue;
    let refMin = r.refMin ?? null;
    let refMax = r.refMax ?? null;
    let unit = targetUnit;

    // приводим значение и ручные границы к единицам правила
    if (targetUnit && r.unit && norm(r.unit) !== norm(targetUnit)) {
      if (value != null) {
        const converted = await convertToUnit(testCode, value, r.unit, targetUnit);
        if (converted.ok) value = converted.value;
      }
      if (refMin != null) {
        const converted = await convertToUnit(testCode, refMin, r.unit, targetUnit);
        if (converted.ok) refMin = converted.value;
      }
      if (refMax != null) {
        const converted = await convertToUnit(testCode, refMax, r.unit, targetUnit);
        if (converted.ok) refMax = converted.value;
      }
    }

    if (!customRange) {
      // пользователь не трогал границы — берём персональное правило
      refMin = resolution.appliedMin;
      refMax = resolution.appliedMax;
      unit = resolution.appliedUnit ?? unit;
    }

    const flag = resolution.matched
      ? evaluateWithPanic(value, refMin, refMax, resolution.panicLow, resolution.panicHigh)
      : flagFromManual(value, refMin, refMax);

    const noteParts = [resolution.note];
    if (
      customRange &&
      resolution.matched &&
      rangesDiffer(refMin, refMax, resolution.appliedMin, resolution.appliedMax)
    ) {
      noteParts.push("границы изменены вручную");
    }

    data.push({
      panelId: id,
      testCode,
      name: r.name,
      value: r.value,
      numericValue: value,
      unit,
      refMin,
      refMax,
      flag,
      appliedNote: noteParts.filter(Boolean).join(" · "),
    });
  }

  await prisma.$transaction([
    prisma.labResult.deleteMany({ where: { panelId: id } }),
    ...(data.length > 0 ? [prisma.labResult.createMany({ data })] : []),
  ]);

  await audit(user.id, "update", "labResults", id, clientIp(req));

  const results = await prisma.labResult.findMany({
    where: { panelId: id },
    orderBy: { name: "asc" },
  });

  return Response.json({ results });
}
