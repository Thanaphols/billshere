import { cookies } from "next/headers";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("billshere_theme")?.value || "green";
  const logoSrc = theme === "green" ? "/greenbillshere.png" : "/billshere.png";

  return (
    <div className="app-shell flex flex-col justify-center px-6 py-10" data-theme={theme}>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-brand">billshere</h1>
        <p className="mt-1 text-sm text-muted">หารบิลกลุ่ม & จ่ายด้วย PromptPay</p>
      </div>
      {children}
    </div>
  );
}
