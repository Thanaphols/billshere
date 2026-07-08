import { requireUser } from "@/lib/auth";
import { promptpayQrDataUrl } from "@/lib/promptpay";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const user = await requireUser();

  let qr: string | null = null;
  if (user.promptpayNumber) {
    qr = await promptpayQrDataUrl(user.promptpayNumber);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-surface p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">โปรไฟล์ของฉัน</h2>
        <ProfileForm
          name={user.name}
          promptpayNumber={user.promptpayNumber ?? ""}
        />
      </div>

      {qr && (
        <div className="rounded-2xl bg-surface p-4 shadow-sm">
          <h3 className="mb-3 font-semibold">QR PromptPay ของฉัน</h3>
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="My PromptPay QR" width={220} height={220} />
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            คนที่ถูกแท็กในบิลของคุณจะเห็น QR นี้พร้อมยอดที่ต้องจ่าย
          </p>
        </div>
      )}

      <p className="px-1 text-xs text-muted">อีเมล: {user.email}</p>
    </div>
  );
}
