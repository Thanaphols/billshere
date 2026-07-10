import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { promptpayQrDataUrl } from "@/lib/promptpay";
import ProfileView from "@/components/ProfileView";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let qr: string | null = null;
  if (user.promptpayNumber) {
    qr = await promptpayQrDataUrl(user.promptpayNumber);
  }

  // Pass down raw user info
  const userData = {
    name: user.name,
    email: user.email,
    promptpayNumber: user.promptpayNumber,
  };

  return <ProfileView user={userData} qr={qr} />;
}
