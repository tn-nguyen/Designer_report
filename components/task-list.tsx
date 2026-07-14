"use client";

import { useState, useTransition } from "react";
import { deleteTask, exportSelected } from "@/actions/tasks";

export type TaskRow = {
  id: number;
  userId: number;
  userName: string;
  tracker: string;
  subject: string;
  sprintName: string | null;
  projectName: string;
  status: string;
  createdAt: Date | string;
};

export function TaskList({
  rows,
  currentUserId,
  role,
  onEdit,
}: {
  rows: TaskRow[];
  currentUserId: number;
  role: "manager" | "member";
  onEdit: (id: number) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const ownRows = rows.filter((r) => r.userId === currentUserId);

  function toggle(id: number) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function selectAllOwnDraft() {
    setSelected(new Set(ownRows.filter((r) => r.status === "draft").map((r) => r.id)));
  }

  function downloadCsv(csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bugtracker-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={selectAllOwnDraft}>
          Chọn tất cả draft của tôi
        </button>
        <button
          type="button"
          disabled={selected.size === 0 || pending}
          className="rounded bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          onClick={() =>
            start(async () => {
              const { csv } = await exportSelected(Array.from(selected));
              downloadCsv(csv);
              setSelected(new Set());
              location.reload();
            })
          }
        >
          {pending ? "Exporting…" : `Export CSV & Mark Imported (${selected.size})`}
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="p-2 w-8"></th>
            <th className="p-2">Subject</th>
            <th className="p-2">Tracker</th>
            <th className="p-2">Project</th>
            <th className="p-2">Sprint</th>
            <th className="p-2">Status</th>
            {role === "manager" && <th className="p-2">User</th>}
            <th className="p-2 w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOwn = r.userId === currentUserId;
            return (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  {isOwn && r.status === "draft" && (
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  )}
                </td>
                <td className="p-2">{r.subject}</td>
                <td className="p-2">{r.tracker}</td>
                <td className="p-2">{r.projectName}</td>
                <td className="p-2">{r.sprintName ?? "—"}</td>
                <td className="p-2">
                  <span
                    className={
                      r.status === "imported"
                        ? "rounded bg-gray-200 px-2 py-0.5 text-xs"
                        : "rounded bg-yellow-200 px-2 py-0.5 text-xs"
                    }
                  >
                    {r.status}
                  </span>
                </td>
                {role === "manager" && <td className="p-2">{r.userName}</td>}
                <td className="p-2">
                  {isOwn && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-blue-600 underline"
                        onClick={() => onEdit(r.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 underline"
                        onClick={() =>
                          confirm("Xoá task này?") &&
                          start(async () => {
                            await deleteTask(r.id);
                            location.reload();
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={role === "manager" ? 8 : 7} className="p-4 text-center text-gray-500">
                Chưa có task nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
