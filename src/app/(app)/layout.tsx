import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import { I18nProvider } from "@/lib/i18n";
import HeaderSettings from "@/components/HeaderSettings";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const theme = cookieStore.get("billshere_theme")?.value || "green";
  const lang = cookieStore.get("billshere_lang")?.value || "th";
  const logoSrc = theme === "green" ? "/greenbillshere.png" : "/billshere.png";

  return (
    <I18nProvider lang={lang as any}>
      <div className="app-shell flex flex-col" data-theme={theme}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              src={logoSrc}
              alt="billshere logo"
              className="h-10 w-auto"
            />
          </div>
          <HeaderSettings
            initialLang={lang as any}
            initialTheme={theme as any}
            userName={user.name}
          />
        </header>

        <main className="flex-1 px-4 py-4 pb-24">{children}</main>

        <BottomNav />
      </div>
    </I18nProvider>
  );
}
