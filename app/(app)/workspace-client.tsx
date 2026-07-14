"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TaskForm } from "@/components/task-form";
import { TaskList, type TaskRow } from "@/components/task-list";

export function WorkspaceClient(props: {
  rows: TaskRow[];
  projects: { id: number; name: string }[];
  trackers: { id: number; name: string }[];
  priorities: { id: number; name: string }[];
  parents: { id: number; subject: string; projectName: string; tracker: string }[];
  teamMembers: { id: number; name: string }[];
  currentUserId: number;
  role: "manager" | "member";
}) {
  const [editingId, setEditingId] = useState<number | undefined>();
  const router = useRouter();
  const sp = useSearchParams();

  const editing = editingId ? props.rows.find((r) => r.id === editingId) : undefined;

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex gap-4">
      <TaskForm
        key={editingId ?? "new"}
        projects={props.projects}
        trackers={props.trackers}
        priorities={props.priorities}
        parents={props.parents}
        initial={editing}
        editingId={editingId}
        onDone={() => {
          setEditingId(undefined);
          router.refresh();
        }}
      />
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label>
            Status:&nbsp;
            <select
              value={sp.get("status") ?? "draft"}
              onChange={(e) => setParam("status", e.target.value)}
              className="rounded border px-2 py-1"
            >
              <option value="draft">Draft</option>
              <option value="imported">Imported</option>
              <option value="all">All</option>
            </select>
          </label>
          {props.role === "manager" && (
            <label>
              User:&nbsp;
              <select
                value={sp.get("user") ?? "all"}
                onChange={(e) => setParam("user", e.target.value)}
                className="rounded border px-2 py-1"
              >
                <option value="all">All team</option>
                {props.teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <TaskList
          rows={props.rows}
          currentUserId={props.currentUserId}
          role={props.role}
          onEdit={setEditingId}
        />
      </div>
    </div>
  );
}
