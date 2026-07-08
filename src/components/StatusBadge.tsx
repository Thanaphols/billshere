import { paymentLabel } from "@/lib/format";

const STYLES: Record<string, string> = {
  UNPAID: "bg-gray-100 text-gray-600",
  SLIP_UPLOADED: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        STYLES[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {paymentLabel(status)}
    </span>
  );
}
