export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell flex flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-3xl">
          🧾
        </div>
        <h1 className="text-2xl font-bold text-brand">billshere</h1>
        <p className="mt-1 text-sm text-muted">หารบิลกลุ่ม & จ่ายด้วย PromptPay</p>
      </div>
      {children}
    </div>
  );
}
