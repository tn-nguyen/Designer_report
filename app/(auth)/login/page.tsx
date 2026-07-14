import { LoginForm } from "@/components/login-form";
import { readSession } from "@/lib/auth/cookie";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect("/");
  return <LoginForm />;
}
