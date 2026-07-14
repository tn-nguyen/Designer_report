"use client";

import { useEffect } from "react";

// Catches errors thrown while rendering the workspace that aren't a
// mid-session Redmine 401 (those are handled server-side in page.tsx,
// upstream of this boundary, since Next.js redacts thrown error messages
// in production builds — string-matching here would only work in dev).
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Đã có lỗi xảy ra.</h2>
      <p className="text-sm text-gray-600">Vui lòng thử lại.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
      >
        Thử lại
      </button>
    </div>
  );
}
