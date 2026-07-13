import { logout } from "@/actions/auth";

export function Header({ name, role }: { name: string; role: "manager" | "member" }) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <h1 className="text-lg font-semibold">Bugtracker Report Tool</h1>
      <div className="flex items-center gap-4 text-sm">
        <span>
          {name} <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{role}</span>
        </span>
        <form action={logout}>
          <button type="submit" className="rounded border px-3 py-1">
            Đăng xuất
          </button>
        </form>
      </div>
    </header>
  );
}
