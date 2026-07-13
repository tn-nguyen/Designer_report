import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Header } from "@/components/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen">
      <Header name={user.db.name} role={user.db.role as "manager" | "member"} />
      <main className="p-6">{children}</main>
    </div>
  );
}
