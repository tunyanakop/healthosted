"use client";

import { templateFor, rowKey } from "@/lib/lab-templates";
import { codeForName } from "@/lib/reference-data";
import { tooltipText } from "@/lib/test-descriptions";
import { InfoTooltip } from "@/components/info-tooltip";

export type RowState = {
  key: string;
  name: string;
  value: string;
  unit: string;
  refMin: string;
  refMax: string;
  code: string | null;
  note: string;
  refEdited?: boolean;
};

export type InitialResult = {
  name: string;
  value: string;
  unit: string | null;
  refMin: number | null;
  refMax: number | null;
  testCode?: string | null;
  appliedNote?: string | null;
  /** сохранённая оценка (low/high/critical/…) для режима просмотра */
  flag?: string;
  /** значение, приведённое к единицам правила */
  numericValue?: number | null;
};

/** Шаблон панели + уже сохранённые значения, сшитые по названию показателя. */
export function buildRows(kind: string | null, initial: InitialResult[]): RowState[] {
  const template = templateFor(kind);
  const rows: RowState[] = (template?.rows ?? []).map((r) => ({
    key: rowKey(r.name),
    name: r.name,
    value: "",
    unit: r.unit ?? "",
    refMin: r.refMin != null ? String(r.refMin) : "",
    refMax: r.refMax != null ? String(r.refMax) : "",
    code: codeForName(r.name, kind),
    note: "",
  }));

  for (const item of initial) {
    const key = rowKey(item.name);
    const existing = rows.find((r) => r.key === key);
    if (existing) {
      existing.value = item.value;
      existing.unit = item.unit ?? existing.unit;
      existing.refMin = item.refMin != null ? String(item.refMin) : existing.refMin;
      existing.refMax = item.refMax != null ? String(item.refMax) : existing.refMax;
      if (item.appliedNote) existing.note = item.appliedNote;
      if (item.testCode) existing.code = item.testCode;
    } else {
      rows.push({
        key,
        name: item.name,
        value: item.value,
        unit: item.unit ?? "",
        refMin: item.refMin != null ? String(item.refMin) : "",
        refMax: item.refMax != null ? String(item.refMax) : "",
        code: item.testCode ?? null,
        note: item.appliedNote ?? "",
      });
    }
  }

  return rows;
}

export function RowsEditor({
  rows,
  onChange,
  allowAdd = false,
  allowRename = false,
}: {
  rows: RowState[];
  onChange: (rows: RowState[]) => void;
  allowAdd?: boolean;
  allowRename?: boolean;
}) {
  function update(index: number, patch: Partial<RowState>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function add() {
    onChange([
      ...rows,
      {
        key: `new-${rows.length}`,
        name: "",
        value: "",
        unit: "",
        refMin: "",
        refMax: "",
        code: null,
        note: "",
      },
    ]);
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3 font-medium">Показатель</th>
              <th className="w-28 py-2 pr-3 font-medium">Значение</th>
              <th className="w-24 py-2 pr-3 font-medium">Ед.</th>
              <th className="w-20 py-2 pr-3 font-medium">От</th>
              <th className="w-20 py-2 pr-3 font-medium">До</th>
              <th className="w-8 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.key}-${i}`} className="border-b border-ink-800/60 last:border-0">
                <td className="py-1.5 pr-3">
                  {allowRename ? (
                    <input
                      className="input py-1"
                      value={r.name}
                      onChange={(e) => update(i, { name: e.target.value, key: `new-${i}` })}
                      placeholder="название показателя"
                    />
                  ) : (
                    <span className="text-slate-300">
                      {r.name}
                      {(() => {
                        const hint = tooltipText(r.code);
                        return hint ? <InfoTooltip text={hint} /> : null;
                      })()}
                      {r.note ? (
                        <span className="mt-0.5 block text-[10px] text-slate-500">{r.note}</span>
                      ) : null}
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    className="input py-1"
                    value={r.value}
                    onChange={(e) => update(i, { value: e.target.value })}
                    inputMode="decimal"
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    className="input py-1 text-xs"
                    value={r.unit}
                    onChange={(e) => update(i, { unit: e.target.value })}
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    className="input py-1 text-xs"
                    value={r.refMin}
                    onChange={(e) => update(i, { refMin: e.target.value, refEdited: true })}
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    className="input py-1 text-xs"
                    value={r.refMax}
                    onChange={(e) => update(i, { refMax: e.target.value, refEdited: true })}
                  />
                </td>
                <td className="py-1.5">
                  {allowAdd || !r.code ? (
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="text-xs text-slate-600 hover:text-rose-400"
                      title="убрать строку"
                    >
                      ×
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 muted">Пока нет полей. Добавь строку или выбери тип исследования.</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {allowAdd ? (
          <button type="button" className="btn" onClick={add}>
            + добавить показатель
          </button>
        ) : null}
        <span className="text-xs text-slate-500">
          Заполняй только то, что есть в бланке. Пустые строки не сохраняются; границы
          можно поправить под свою лабораторию — они сохранятся.
        </span>
      </div>
    </div>
  );
}
