"use client";

import { useState, useTransition } from "react";

export function RefreshButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <button
      type="button"
      className="rounded border px-3 py-1 text-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await fetch("/api/redmine/refresh", { method: "POST" });
          const data = await res.json();
          setMsg(data.ok ? "Đã refresh" : "Lỗi refresh");
          setTimeout(() => setMsg(null), 2000);
          location.reload();
        })
      }
    >
      {pending ? "Đang refresh…" : msg ?? "Refresh cache"}
    </button>
  );
}
