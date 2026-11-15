-- AlterTable
ALTER TABLE "Condition" ADD COLUMN "seasonalKind" TEXT;
ALTER TABLE "Condition" ADD COLUMN "severity" TEXT;

-- Переносим сезонные эпизоды в историю болезней, чтобы не потерять данные
INSERT INTO "Condition" (
  "id", "userId", "title", "icd10", "status", "onsetAt", "resolvedAt",
  "notes", "seasonalKind", "severity", "createdAt", "updatedAt"
)
SELECT
  "id",
  "userId",
  CASE "kind"
    WHEN 'flu' THEN 'Грипп'
    WHEN 'arvi' THEN 'ОРВИ'
    WHEN 'covid' THEN 'COVID-19'
    ELSE 'Сезонная инфекция'
  END,
  NULL,
  CASE WHEN "endedAt" IS NULL THEN 'active' ELSE 'resolved' END,
  "startedAt",
  "endedAt",
  "notes",
  "kind",
  "severity",
  "createdAt",
  "createdAt"
FROM "SeasonalEpisode";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SeasonalEpisode";
PRAGMA foreign_keys=on;
