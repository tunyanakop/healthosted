"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export type AttachmentItem = {
  id: string;
  filename: string;
  size: number;
  mime: string;
};

function kb(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function Attachments({
  uploadUrl,
  items,
  hint = "+ прикрепить PDF или скан",
}: {
  uploadUrl: string;
  items: AttachmentItem[];
  hint?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(uploadUrl, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось загрузить файл");
        return;
      }
      router.refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Удалить файл?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Не удалось удалить");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-ink-800 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer text-xs text-slate-400 transition-colors hover:text-accent">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
          {busy ? "загружаю…" : hint}
        </label>
        <span className="text-[11px] text-slate-600">до 25 МБ</span>
        {error ? <span className="text-xs text-rose-400">{error}</span> : null}
      </div>

      {items.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <a
                href={`/api/files/${a.id}`}
                className="truncate text-slate-300 hover:text-accent hover:underline"
              >
                {a.filename}
              </a>
              <span className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                {kb(a.size)}
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  disabled={busy}
                  className="hover:text-rose-400"
                >
                  удалить
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
