"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CUSTOM_TEMPLATE, templateFor } from "@/lib/lab-templates";
import {
  FLAG_META,
  computeFlag,
  formatRef,
  isAbnormal,
  parseNumeric,
  type LabFlag,
} from "@/lib/labs";
import { tooltipText } from "@/lib/test-descriptions";
import { InfoTooltip } from "@/components/info-tooltip";
import { RowsEditor, buildRows, type InitialResult, type RowState } from "../rows-editor";

type SavedRow = {
  key: string;
  name: string;
  value: string;
  unit: string;
  refMin: number | null;
  refMax: number | null;
  code: string | null;
  note: string;
  flag: LabFlag;
};

/** Полоска слева и фон строки: только отклонения подсвечиваем. */
const ROW_ACCENT: Record<LabFlag, string> = {
  low: "border-l-2 border-l-sky-400/70 bg-sky-500/5",
  high: "border-l-2 border-l-rose-400/70 bg-rose-500/5",
  critical: "border-l-2 border-l-rose-400 bg-rose-500/15",
  normal: "border-l-2 border-l-transparent",
  unknown: "border-l-2 border-l-transparent",
};

function toSavedRow(r: InitialResult): SavedRow {
  const numeric = r.numericValue ?? parseNumeric(r.value);
  const flag = (r.flag as LabFlag | undefined) ?? computeFlag(numeric, r.refMin, r.refMax);
  return {
    key: r.name,
    name: r.name,
    value: r.value,
    unit: r.unit ?? "",
    refMin: r.refMin,
    refMax: r.refMax,
    code: r.testCode ?? null,
    note: r.appliedNote ?? "",
    flag,
  };
}

export function ResultsGrid({
  panelId,
  kind,
  initial,
}: {
  panelId: string;
  kind: string | null;
  initial: InitialResult[];
}) {
  const router = useRouter();
  const isTemplate = Boolean(templateFor(kind));

  const [saved, setSaved] = useState<InitialResult[]>(initial);
  const [rows, setRows] = useState<RowState[]>(() => buildRows(kind, initial));
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // в сохранённом виде показываем только заполненные показатели
  const visible = useMemo(
    () =>
      saved
        .filter((r) => r.value.trim() !== "" && r.name.trim() !== "")
        .map(toSavedRow),
    [saved],
  );

  function startEdit() {
    setRows(buildRows(kind, saved));
    setStatus(null);
    setMode("edit");
  }

  function cancelEdit() {
    setRows(buildRows(kind, saved));
    setStatus(null);
    setMode("view");
  }

  async function save() {
    setBusy(true);
    setStatus(null);

    const filled = rows.filter((r) => r.value.trim() !== "" && r.name.trim() !== "");

    try {
      const res = await fetch(`/api/labs/${panelId}/results`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          results: filled.map((r) => ({
            name: r.name,
            code: r.code ?? "",
            value: r.value,
            unit: r.unit,
            refMin: r.refMin,
            refMax: r.refMax,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "err", text: data.error ?? "Не удалось сохранить" });
        return;
      }
      const stored = (data.results ?? []) as {
        name: string;
        value: string;
        numericValue: number | null;
        flag: string;
        unit: string | null;
        refMin: number | null;
        refMax: number | null;
        testCode: string | null;
        appliedNote: string | null;
      }[];

      const next: InitialResult[] = stored.map((r) => ({
        name: r.name,
        value: r.value,
        numericValue: r.numericValue,
        flag: r.flag,
        unit: r.unit,
        refMin: r.refMin,
        refMax: r.refMax,
        testCode: r.testCode,
        appliedNote: r.appliedNote,
      }));

      setSaved(next);
      setRows(buildRows(kind, next));
      setMode("view");
      setStatus({ kind: "ok", text: `Сохранено показателей: ${stored.length}` });
      router.refresh();
    } catch {
      setStatus({ kind: "err", text: "Сеть недоступна" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Показатели</h2>
          <p className="text-xs text-slate-500">
            {mode === "view"
              ? visible.length > 0
                ? `Сохранено показателей: ${visible.length}. Отклонения подсвечены.`
                : "Показатели не заполнены."
              : "Поля подставлены по типу исследования. Заполняй только то, что есть в бланке; заполненные строки сохранятся, пустые не попадут в архив."}
          </p>
        </div>
        {mode === "view" ? (
          <button type="button" className="btn" onClick={startEdit}>
            изменить
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" className="btn" onClick={cancelEdit} disabled={busy}>
              Отмена
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        )}
      </div>

      {mode === "view" ? (
        visible.length === 0 ? (
          <p className="muted">
            Показателей нет. Нажми «изменить», чтобы заполнить поля из бланка.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-medium">Показатель</th>
                  <th className="w-32 py-2 pr-3 font-medium">Значение</th>
                  <th className="w-40 py-2 pr-3 font-medium">Референс</th>
                  <th className="w-28 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const meta = FLAG_META[r.flag];
                  const abnormal = isAbnormal(r.flag);
                  const hint = tooltipText(r.code);
                  return (
                    <tr
                      key={r.key}
                      className={`border-b border-ink-800/60 last:border-0 ${ROW_ACCENT[r.flag]}`}
                    >
                      <td className="py-2 pr-3">
                        <span className={abnormal ? meta.text : "text-slate-300"}>
                          {r.name}
                          {hint ? <InfoTooltip text={hint} /> : null}
                        </span>
                        {r.note && r.note !== "нет референса" ? (
                          <span className="mt-0.5 block text-[10px] text-slate-500">{r.note}</span>
                        ) : null}
                      </td>
                      <td
                        className={`py-2 pr-3 font-medium tabular-nums ${
                          abnormal ? meta.text : "text-slate-100"
                        }`}
                      >
                        {r.value}
                        {r.unit ? <span className="ml-1 text-xs text-slate-400">{r.unit}</span> : null}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500">
                        {formatRef(r.refMin, r.refMax, r.unit)}
                      </td>
                      <td className="py-2">
                        {abnormal ? (
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] ${meta.badge}`}>
                            {meta.label}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <RowsEditor
          rows={rows}
          onChange={setRows}
          allowAdd={!isTemplate}
          allowRename={!kind || kind === CUSTOM_TEMPLATE}
        />
      )}

      {mode === "edit" ? (
        <p className="mt-3 text-xs text-slate-500">
          Сохраняются только заполненные строки; очистишь значение — показатель удалится.
          Изменённые границы сохраняются как твои.
        </p>
      ) : null}

      {status ? (
        <span
          className={
            status.kind === "ok" ? "mt-2 block text-sm text-emerald-400" : "mt-2 block text-sm text-rose-400"
          }
        >
          {status.text}
        </span>
      ) : null}
    </section>
  );
}
