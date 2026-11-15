import { z } from "zod";
import { KIND_MAP, type Kind } from "@/lib/measurements";

const email = z
  .string()
  .trim()
  .min(3, "Укажи email")
  .max(254, "Слишком длинный email")
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Некорректный email")
  .transform((v) => v.toLowerCase());

const password = z
  .string()
  .min(8, "Минимум 8 символов")
  .max(200, "Максимум 200 символов");

export const registerSchema = z.object({
  email,
  password,
  name: z.string().trim().max(120).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Введи пароль").max(200),
});

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const profileSchema = z.object({
  name: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(120, "Слишком длинное имя").optional(),
  ),
  birthDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
      .optional(),
  ),
  sex: z.preprocess(
    emptyToUndefined,
    z.enum(["male", "female", "other"]).optional(),
  ),
  bloodType: z.preprocess(
    emptyToUndefined,
    z.enum(["O(I)", "A(II)", "B(III)", "AB(IV)"]).optional(),
  ),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Введи текущий пароль"),
  newPassword: password,
});

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Некорректные данные";
}

const kindValues = Object.keys(KIND_MAP) as [Kind, ...Kind[]];

export const measurementSchema = z
  .object({
    kind: z.enum(kindValues),
    value: z.coerce.number({ message: "Введи числовое значение" }),
    value2: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.coerce.number().optional(),
    ),
    measuredAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Дата в формате ГГГГ-ММ-ДД"),
    note: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(500, "Слишком длинная заметка").optional(),
    ),
  })
  .superRefine((data, ctx) => {
    const meta = KIND_MAP[data.kind];
    if (data.value < meta.min || data.value > meta.max) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `Значение вне диапазона ${meta.min}–${meta.max} ${meta.unit}`,
      });
    }
    if (meta.secondary) {
      if (data.value2 == null) {
        ctx.addIssue({ code: "custom", path: ["value2"], message: "Нужно диастолическое значение" });
      } else if (data.value2 < 20 || data.value2 > 200) {
        ctx.addIssue({ code: "custom", path: ["value2"], message: "Диастолическое вне диапазона 20–200" });
      } else if (data.value2 > data.value) {
        ctx.addIssue({ code: "custom", path: ["value2"], message: "Диастолическое не может быть выше систолического" });
      }
    }
  });

const dateOnly = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
    .optional(),
);

export const conditionSchema = z
  .object({
    title: z.string().trim().min(2, "Укажи название").max(200, "Слишком длинное название"),
    icd10: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z
        .string()
        .trim()
        .max(12, "Слишком длинный код")
        .regex(/^[A-Za-z]\d{2}(\.\d{1,2})?$/, "Код МКБ-10 вида A00 или A00.1")
        .optional(),
    ),
    status: z.enum(["active", "remission", "resolved"]).default("active"),
    onsetAt: dateOnly,
    resolvedAt: dateOnly,
    notes: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(2000, "Слишком длинная заметка").optional(),
    ),
    seasonalKind: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.enum(["flu", "arvi", "covid", "other"]).optional(),
    ),
    severity: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.enum(["mild", "moderate", "severe"]).optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.onsetAt && data.resolvedAt && data.resolvedAt < data.onsetAt) {
      ctx.addIssue({
        code: "custom",
        path: ["resolvedAt"],
        message: "Дата окончания раньше даты начала",
      });
    }
    if (data.status === "resolved" && !data.resolvedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["resolvedAt"],
        message: "Укажи дату окончания для статуса «вылечено»",
      });
    }
  });

export const visitSchema = z
  .object({
    visitedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД"),
    doctorName: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(160).optional(),
    ),
    specialty: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(120).optional(),
    ),
    clinic: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(200).optional(),
    ),
    reason: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(500).optional(),
    ),
    diagnosis: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(500).optional(),
    ),
    conclusion: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(4000).optional(),
    ),
    recommendations: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(4000).optional(),
    ),
    conditionId: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().max(64).optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (!data.doctorName && !data.clinic && !data.reason && !data.conclusion && !data.diagnosis) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Заполни хотя бы причину, врача или заключение",
      });
    }
  });

export const medbookSchema = z
  .object({
    type: z.enum(["fluorography", "checkup", "sanminimum", "vaccination", "other"]),
    number: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(80).optional(),
    ),
    issuer: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(200).optional(),
    ),
    issuedAt: dateOnly,
    validUntil: dateOnly,
    notes: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(1000).optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.issuedAt && data.validUntil && data.validUntil < data.issuedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "Срок действия раньше даты выдачи",
      });
    }
  });

const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().finite("Нужно число").optional(),
);

export const labPanelSchema = z.object({
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД"),
  kind: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.string().trim().max(40).optional(),
  ),
  specimen: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.enum(["any", "venous_blood", "capillary_blood", "serum", "plasma", "urine"]).optional(),
  ),
  pregnant: z.boolean().nullable().optional(),
  trimester: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(1).max(3).optional(),
  ),
  menopause: z.boolean().nullable().optional(),
  cyclePhase: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.enum(["follicular", "ovulation", "luteal"]).optional(),
  ),
  labName: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(200).optional(),
  ),
  notes: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(1000).optional(),
  ),
});

export const labResultSchema = z
  .object({
    name: z.string().trim().min(1, "Укажи показатель").max(120),
    value: z.string().trim().min(1, "Укажи значение").max(60),
    unit: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(30).optional(),
    ),
    refMin: optionalNumber,
    refMax: optionalNumber,
  })
  .superRefine((data, ctx) => {
    if (data.refMin != null && data.refMax != null && data.refMin > data.refMax) {
      ctx.addIssue({
        code: "custom",
        path: ["refMax"],
        message: "Верхняя граница меньше нижней",
      });
    }
  });

const months = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z
    .string()
    .regex(/^\d{1,2}(,\d{1,2})*$/, "Месяцы через запятую: 3,4,5")
    .refine(
      (v) => v.split(",").every((m) => Number(m) >= 1 && Number(m) <= 12),
      "Месяцы от 1 до 12",
    )
    .optional(),
);

export const allergySchema = z.object({
  name: z.string().trim().min(2, "Укажи аллерген").max(80),
  category: z.enum(["pollen", "mold", "dust", "animal", "food", "medication", "other"]),
  severity: z.enum(["mild", "moderate", "severe"]).default("moderate"),
  months,
  notes: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
  active: z.boolean().default(true),
});

export const episodeSchema = z
  .object({
    kind: z.enum(["flu", "arvi", "covid", "other"]),
    startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД"),
    endedAt: dateOnly,
    severity: z.enum(["mild", "moderate", "severe"]).default("moderate"),
    notes: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().max(500).optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.endedAt && data.endedAt < data.startedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endedAt"],
        message: "Окончание раньше начала",
      });
    }
  });

export const envSettingsSchema = z.object({
  latitude: z.coerce.number().min(-90, "Широта от -90 до 90").max(90, "Широта от -90 до 90"),
  longitude: z.coerce
    .number()
    .min(-180, "Долгота от -180 до 180")
    .max(180, "Долгота от -180 до 180"),
  locationName: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(120).optional(),
  ),
  envEnabled: z.boolean().default(true),
  incidence: z.preprocess(
    (v) => (v === "" || v === "none" || v === null ? null : v),
    z.enum(["low", "medium", "high"]).nullable().optional(),
  ),
});

export const labResultsBulkSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Пустое название показателя").max(120),
        code: z.preprocess(
          (v) => (v === "" || v === null ? undefined : v),
          z.string().trim().max(20).optional(),
        ),
        value: z.string().trim().max(60),
        unit: z.preprocess(
          (v) => (v === "" || v === null ? undefined : v),
          z.string().trim().max(30).optional(),
        ),
        refMin: optionalNumber,
        refMax: optionalNumber,
      }),
    )
    .max(120, "Слишком много показателей в панели"),
});

export const labPreviewSchema = z.object({
  codes: z.array(z.string().trim().min(1).max(20)).max(80),
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  specimen: z.enum(["any", "venous_blood", "capillary_blood", "serum", "plasma", "urine"]).optional(),
  pregnant: z.boolean().nullable().optional(),
  trimester: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(1).max(3).optional(),
  ),
  menopause: z.boolean().nullable().optional(),
  cyclePhase: z.enum(["follicular", "ovulation", "luteal"]).optional(),
});
