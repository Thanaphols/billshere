"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { uploadSlip, type SlipState } from "@/actions/slips";

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl border border-brand px-4 py-2.5 font-semibold text-brand disabled:opacity-60"
    >
      {pending ? "กำลังอัปโหลด…" : "อัปโหลดสลิป"}
    </button>
  );
}

export default function SlipUpload({ participantId }: { participantId: string }) {
  const action = uploadSlip.bind(null, participantId);
  const [state, formAction] = useActionState<SlipState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="space-y-2">
      <input
        type="file"
        name="slip"
        accept="image/png,image/jpeg,image/webp"
        required
        className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">อัปโหลดสำเร็จ ✓</p>}
      <Btn />
    </form>
  );
}
