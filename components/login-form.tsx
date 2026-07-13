"use client";

import { useActionState } from "react";
import { login } from "@/actions/auth";

const initialState: { error?: string } = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  return (
    <form action={formAction} className="mx-auto mt-24 max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Đăng nhập</h1>
      <p className="text-sm text-gray-600">
        Nhập Redmine API key cá nhân (lấy từ trang My account trên bugtracker).
      </p>
      <label className="block">
        <span className="text-sm">API key</span>
        <input
          type="password"
          name="apiKey"
          required
          className="mt-1 block w-full rounded border px-3 py-2 font-mono text-sm"
          placeholder="xxxxxxxx…"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Đang xác thực…" : "Đăng nhập"}
      </button>
    </form>
  );
}
