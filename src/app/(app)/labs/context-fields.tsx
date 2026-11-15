"use client";

export type PanelContext = {
  specimen: string;
  pregnant: boolean;
  trimester: string;
  menopause: boolean;
  cyclePhase: string;
};

export const SPECIMENS = [
  { value: "any", label: "не указан" },
  { value: "venous_blood", label: "венозная кровь" },
  { value: "capillary_blood", label: "капиллярная кровь" },
  { value: "serum", label: "сыворотка" },
  { value: "plasma", label: "плазма" },
  { value: "urine", label: "моча" },
];

export function defaultSpecimen(kind: string): string {
  if (kind === "urine") return "urine";
  if (kind === "coag") return "plasma";
  if (kind === "cbc") return "venous_blood";
  if (kind === "custom") return "any";
  return "serum";
}

export function emptyContext(kind: string): PanelContext {
  return {
    specimen: defaultSpecimen(kind),
    pregnant: false,
    trimester: "1",
    menopause: false,
    cyclePhase: "",
  };
}

export function PanelContextFields({
  sex,
  value,
  onChange,
}: {
  sex: string | null;
  value: PanelContext;
  onChange: (next: PanelContext) => void;
}) {
  function update(patch: Partial<PanelContext>) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="specimen">Биоматериал</label>
          <select
            id="specimen"
            className="input"
            value={value.specimen}
            onChange={(e) => update({ specimen: e.target.value })}
          >
            {SPECIMENS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {sex === "female" ? (
        <div className="rounded-lg border border-ink-800 p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            Контекст на дату сдачи — уточняет референс
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={value.pregnant}
                onChange={(e) =>
                  update({
                    pregnant: e.target.checked,
                    menopause: e.target.checked ? false : value.menopause,
                  })
                }
              />
              беременность
            </label>

            {value.pregnant ? (
              <label className="flex items-center gap-2 text-slate-400">
                триместр
                <select
                  className="input w-auto py-1"
                  value={value.trimester}
                  onChange={(e) => update({ trimester: e.target.value })}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </label>
            ) : null}

            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={value.menopause}
                disabled={value.pregnant}
                onChange={(e) => update({ menopause: e.target.checked, cyclePhase: "" })}
              />
              менопауза
            </label>

            {!value.pregnant && !value.menopause ? (
              <label className="flex items-center gap-2 text-slate-400">
                фаза цикла
                <select
                  className="input w-auto py-1"
                  value={value.cyclePhase}
                  onChange={(e) => update({ cyclePhase: e.target.value })}
                >
                  <option value="">не указана</option>
                  <option value="follicular">фолликулярная</option>
                  <option value="ovulation">овуляция</option>
                  <option value="luteal">лютеиновая</option>
                </select>
              </label>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
