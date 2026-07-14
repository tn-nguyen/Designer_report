"use client";

import { useState, useTransition, useEffect } from "react";
import { createTask, updateTask } from "@/actions/tasks";
import { getVersions } from "@/actions/metadata";
import type { TaskInput } from "@/lib/validation/task";

export type Option = { id: number; name: string };
export type ParentOption = { id: number; subject: string; projectName: string; tracker: string };

const VN_WEEKDAYS = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

function todayISO(): string {
  return toISO(new Date());
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysISO(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

function diffDaysISO(startIso: string, dueIso: string): number {
  const ms = parseISO(dueIso).getTime() - parseISO(startIso).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** "YYYY-MM-DD" -> "Thứ X, DD/MM/YYYY" */
function formatVNDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const weekday = VN_WEEKDAYS[parseISO(iso).getDay()];
  return `${weekday}, ${d}/${m}/${y}`;
}

export function TaskForm({
  projects,
  trackers,
  priorities,
  parents,
  initial,
  editingId,
  onDone,
}: {
  projects: Option[];
  trackers: Option[];
  priorities: Option[];
  parents: ParentOption[];
  initial?: Partial<TaskInput>;
  editingId?: number;
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tracker, setTracker] = useState(initial?.tracker ?? trackers[0]?.name ?? "");
  const [projectId, setProjectId] = useState<number | null>(initial?.projectId ?? projects[0]?.id ?? null);
  const [projectName, setProjectName] = useState(initial?.projectName ?? projects[0]?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "");
  const [sprintName, setSprintName] = useState(initial?.sprintName ?? "");
  const [parentTaskId, setParentTaskId] = useState<number | "">(initial?.parentTaskId ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate || todayISO());
  const [daysToComplete, setDaysToComplete] = useState<string>(() => {
    if (initial?.startDate && initial?.dueDate) {
      const diff = diffDaysISO(initial.startDate, initial.dueDate);
      if (diff >= 0) return String(diff);
    }
    return "";
  });
  const [versions, setVersions] = useState<Option[]>([]);
  const [parentQuery, setParentQuery] = useState("");

  useEffect(() => {
    if (!projectId) return setVersions([]);
    getVersions(projectId).then(setVersions).catch(() => setVersions([]));
  }, [projectId]);

  function reset() {
    setSubject("");
    setDescription("");
    setPriority("");
    setParentTaskId("");
    setStartDate(todayISO());
    setDaysToComplete("");
    // Keep projectId + sprint for fast batch entry.
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!projectId) return setError("Chọn project.");
    // Start date always has a value in the UI, but guard anyway in case a
    // user cleared the field and typed a day count before it re-filled.
    const effectiveStart = startDate || todayISO();
    if (!startDate) setStartDate(effectiveStart);
    const days = daysToComplete === "" ? null : Number(daysToComplete);
    const computedDue = days !== null && Number.isFinite(days) ? addDaysISO(effectiveStart, days) : null;
    const input: TaskInput = {
      tracker,
      subject,
      description: description || null,
      priority: priority || null,
      projectId,
      projectName,
      sprintName: sprintName || null,
      parentTaskId: parentTaskId === "" ? null : Number(parentTaskId),
      startDate: effectiveStart,
      dueDate: computedDue,
    };
    start(async () => {
      const result = editingId
        ? await updateTask(editingId, input)
        : await createTask(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      reset();
      onDone?.();
    });
  }

  const filteredParents = parents
    .filter((p) => (parentQuery ? p.subject.toLowerCase().includes(parentQuery.toLowerCase()) || String(p.id).includes(parentQuery) : true))
    .slice(0, 20);

  const hintStart = startDate || todayISO();
  const hintDaysNum = daysToComplete === "" ? null : Number(daysToComplete);
  const hintDue =
    hintDaysNum !== null && Number.isFinite(hintDaysNum) ? addDaysISO(hintStart, hintDaysNum) : null;

  return (
    <form onSubmit={onSubmit} className="w-80 shrink-0 space-y-3 border-r p-4 text-sm">
      <h2 className="text-base font-semibold">
        {editingId ? "Sửa task" : "New task"}
      </h2>

      <label className="block">
        <span className="text-xs text-gray-600">Tracker</span>
        <select value={tracker} onChange={(e) => setTracker(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1">
          {trackers.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Project *</span>
        <select
          value={projectId ?? ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            const p = projects.find((x) => x.id === id);
            setProjectId(id);
            setProjectName(p?.name ?? "");
            setSprintName("");
          }}
          className="mt-1 block w-full rounded border px-2 py-1"
          required
        >
          <option value="">— Chọn —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Subject *</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={255} className="mt-1 block w-full rounded border px-2 py-1" />
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Description</span>
        <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 block w-full rounded border px-2 py-1" />
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Priority</span>
        <select value={priority ?? ""} onChange={(e) => setPriority(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1">
          <option value="">—</option>
          {priorities.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Sprint</span>
        <select value={sprintName ?? ""} onChange={(e) => setSprintName(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1">
          <option value="">—</option>
          {versions.map((v) => (
            <option key={v.id} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Parent task</span>
        <input value={parentQuery} onChange={(e) => setParentQuery(e.target.value)} placeholder="Tìm subject hoặc id…" className="mt-1 block w-full rounded border px-2 py-1" />
        <select
          value={parentTaskId === "" ? "" : String(parentTaskId)}
          onChange={(e) => setParentTaskId(e.target.value === "" ? "" : Number(e.target.value))}
          size={4}
          className="mt-1 block w-full rounded border px-2 py-1"
        >
          <option value="">—</option>
          {filteredParents.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.id} — [{p.tracker}] {p.subject} ({p.projectName})
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-600">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">Số ngày hoàn thành</span>
          <input
            type="number"
            min={0}
            step={1}
            value={daysToComplete}
            onChange={(e) => setDaysToComplete(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1"
          />
        </label>
        <p className="col-span-2 text-xs text-gray-500">
          {hintDue
            ? `Bắt đầu: ${formatVNDate(hintStart)} → Hoàn thành: ${formatVNDate(hintDue)}`
            : `Bắt đầu: ${formatVNDate(hintStart)}`}
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button type="submit" disabled={pending} className="w-full rounded bg-blue-600 py-2 text-white disabled:opacity-50">
        {pending ? "Đang lưu…" : editingId ? "Save changes" : "Add task"}
      </button>
    </form>
  );
}
