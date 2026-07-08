import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import BottomNav from "@/components/BottomNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="app-shell flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧾</span>
          <span className="font-bold text-brand">billshere</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{user.name}</span>
          <form action={logoutAction}>
            <button className="text-sm text-red-500" type="submit">
              ออก
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-6">{children}</main>

      <BottomNav />
    </div>
  );
}
