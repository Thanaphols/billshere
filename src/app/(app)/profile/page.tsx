import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { promptpayQrDataUrl } from "@/lib/promptpay";
import ProfileView from "@/components/ProfileView";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // One QR per number so the profile can switch between them client-side.
  const numbers = [user.promptpayNumber, ...user.promptpayExtras].filter((n): n is string => !!n);
  const qrs = await Promise.all(
    numbers.map(async (number) => ({ number, qr: await promptpayQrDataUrl(number) }))
  );

  // Pass down raw user info
  const userData = {
    name: user.name,
    email: user.email,
    promptpayNumber: user.promptpayNumber,
    promptpayExtras: user.promptpayExtras,
  };

  return <ProfileView user={userData} qrs={qrs} />;
}
