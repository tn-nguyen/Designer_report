"use client";

import { useEffect } from "react";
import { clearAndRedirect } from "@/actions/auth";

// Catches errors thrown while rendering the workspace. If a user's Redmine
// API key is revoked (or otherwise invalidated) mid-session, RedmineClient
// throws a RedmineError formatted as "Redmine 401 for ..." — detect that
// here and bounce to /login instead of showing Next's crash screen.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isSessionExpired = error.message.includes("Redmine 401");

  useEffect(() => {
    if (isSessionExpired) {
      clearAndRedirect();
    } else {
      console.error(error);
    }
  }, [error, isSessionExpired]);

  if (isSessionExpired) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-sm text-gray-600">
        Phiên đăng nhập đã hết hạn, đang chuyển hướng đến trang đăng nhập…
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Đã có lỗi xảy ra.</h2>
      <p className="text-sm text-gray-600">{error.message || "Vui lòng thử lại."}</p>
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
