import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/**
 * Build a PromptPay QR image (PNG data URL) for a given target and amount.
 *
 * @param target  PromptPay id — a mobile number (e.g. 0812345678) or a 13-digit
 *                national ID / tax id.
 * @param amount  Amount in baht. Omit / 0 to produce an "any amount" QR.
 */
export async function promptpayQrDataUrl(
  target: string,
  amount?: number
): Promise<string> {
  const payload = generatePayload(sanitize(target), {
    amount: amount && amount > 0 ? Number(amount.toFixed(2)) : undefined,
  });
  return QRCode.toDataURL(payload, {
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
  });
}

/** Strip spaces and dashes people commonly type into a phone number. */
function sanitize(target: string): string {
  return target.replace(/[\s-]/g, "");
}
