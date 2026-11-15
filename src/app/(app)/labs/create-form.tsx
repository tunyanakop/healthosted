"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LAB_TEMPLATES, CUSTOM_TEMPLATE, templateFor } from "@/lib/lab-templates";
import { codeForName } from "@/lib/reference-data";
import { useFormClose } from "@/components/add-drawer";
import { RowsEditor, buildRows, type RowState } from "./rows-editor";
import { PanelContextFields, defaultSpecimen, emptyContext, type PanelContext } from "./context-fields";

function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function LabCreateForm({ sex }: { sex: string | null }) {
  const router = useRouter();
  const close = useFormClose();

  const [kind, setKind] = useState("cbc");
  const [takenAt, setTakenAt] = useState(today());
  const [labName, setLabName] = useState("");
  const [notes, setNotes] = useState("");
  const [context, setContext] = useState<PanelContext>(() => emptyContext("cbc"));
  const [rows, setRows] = useState<RowState[]>(() => buildRows("cbc", []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codes = useMemo(() => {
    const rowsTemplate = templateFor(kind)?.rows ?? [];
    return rowsTemplate
      .map((r) => codeForName(r.name, kind))
      .filter((c): c is string => Boolean(c));
  }, [kind]);

  // персональные нормы (пол, возраст, биоматериал, состояние) до сохранения
  useEffect(() => {
    if (codes.length === 0) return;
    let cancelled = false;

    fetch("/api/labs/preview-refs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        codes,
        takenAt,
        specimen: context.specimen,
        pregnant: context.pregnant,
        trimester: context.pregnant ? context.trimester : "",
        menopause: context.menopause,
        cyclePhase: context.cyclePhase,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.ranges) return;
        setRows((prev) =>
          prev.map((row) => {
            const preview = row.code ? data.ranges[row.code] : null;
            if (!preview || row.refEdited) return row;
            return {
              ...row,
              unit: preview.unit ?? row.unit,
              refMin: preview.min != null ? String(preview.min) : "",
              refMax: preview.max != null ? String(preview.max) : "",
              note: preview.note ?? row.note,
            };
          }),
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes, takenAt, context.specimen, context.pregnant, context.trimester, context.menopause, context.cyclePhase]);

  function changeKind(next: string) {
    const entered = new Map(rows.filter((r) => r.value.trim() !== "").map((r) => [r.key, r]));
    const rebuilt = buildRows(next, []).map((r) => {
      const prev = entered.get(r.key);
      return prev ? { ...r, value: prev.value } : r;
    });
    setKind(next);
    setRows(rebuilt);
    setContext((prev) => ({ ...prev, specimen: defaultSpecimen(next) }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const filled = rows.filter((r) => r.value.trim() !== "" && r.name.trim() !== "");

    try {
      const panelRes = await fetch("/api/labs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          takenAt,
          labName,
          notes,
          kind,
          specimen: context.specimen,
          pregnant: context.pregnant,
          trimester: context.pregnant ? context.trimester : "",
          menopause: context.menopause,
          cyclePhase: context.cyclePhase,
        }),
      });
      const panelData = await panelRes.json().catch(() => ({}));
      if (!panelRes.ok) {
        setError(panelData.error ?? "Не удалось создать панель");
        return;
      }

      const panelId = panelData.item.id as string;

      if (filled.length > 0) {
        const resultsRes = await fetch(`/api/labs/${panelId}/results`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            results: filled.map((r) => ({
              name: r.name,
              code: r.code ?? "",
              value: r.value,
              unit: r.unit,
              refMin: r.refEdited ? r.refMin : "",
              refMax: r.refEdited ? r.refMax : "",
            })),
          }),
        });

        if (!resultsRes.ok) {
          const data = await resultsRes.json().catch(() => ({}));
          setError(data.error ?? "Панель создана, но показатели не сохранились");
          return;
        }
      }

      if (close) close();
      router.push(`/labs/${panelId}`);
      router.refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lab-kind">Тип исследования</label>
          <select
            id="lab-kind"
            className="input"
            value={kind}
            onChange={(e) => changeKind(e.target.value)}
          >
            {LAB_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="lab-name">Лаборатория</label>
          <input
            id="lab-name"
            className="input"
            value={labName}
            onChange={(e) => setLabName(e.target.value)}
            placeholder="Инвитро, Гемотест, поликлиника…"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lab-date">Дата сдачи</label>
          <input
            id="lab-date"
            type="date"
            className="input"
            value={takenAt}
            onChange={(e) => setTakenAt(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="lab-notes">Заметка</label>
          <input
            id="lab-notes"
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="натощак, после болезни…"
          />
        </div>
      </div>

      <PanelContextFields sex={sex} value={context} onChange={setContext} />

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium">Показатели</span>
          <span className="text-xs text-slate-500">
            {kind === CUSTOM_TEMPLATE
              ? "свой набор: добавь строки вручную"
              : "поля по типу исследования — заполняй только те, что есть в бланке"}
          </span>
        </div>
        <RowsEditor
          rows={rows}
          onChange={setRows}
          allowAdd={kind === CUSTOM_TEMPLATE}
          allowRename={kind === CUSTOM_TEMPLATE}
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Сохраняю…" : "Сохранить панель"}
        </button>
        {error ? <span className="text-sm text-rose-400">{error}</span> : null}
      </div>

      <p className="text-xs text-slate-500">
        Референс подбирается автоматически: тест → биоматериал → пол → возраст в днях →
        состояние (беременность, менопауза, фаза цикла). Числа приводятся к нужным единицам,
        критические значения помечаются отдельно.
      </p>
    </form>
  );
}
