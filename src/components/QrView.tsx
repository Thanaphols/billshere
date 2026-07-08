import { baht } from "@/lib/format";

export default function QrView({
  dataUrl,
  amount,
  payeeName,
}: {
  dataUrl: string;
  amount: number;
  payeeName: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="PromptPay QR" width={240} height={240} />
      <p className="mt-2 text-sm text-muted">โอนให้ {payeeName}</p>
      <p className="text-xl font-bold text-brand">{baht(amount)}</p>
    </div>
  );
}
