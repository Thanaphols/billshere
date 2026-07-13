import { createPost } from "@/actions/posts";
import SubmitButton from "@/components/SubmitButton";

export default function NewPostPage() {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">สร้างบิลใหม่</h2>
      <form action={createPost} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">ชื่อบิล</span>
          <input
            name="title"
            required
            placeholder="เช่น ชานมเย็นวันศุกร์"
            className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand"
          />
          <span className="mt-1 block text-xs text-muted">
            ตั้งชื่อร้าน/มื้อ ให้เพื่อนรู้ว่าเป็นบิลอะไร
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">โน้ต (ไม่บังคับ)</span>
          <input
            name="note"
            placeholder="รายละเอียดเพิ่มเติม"
            className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand"
          />
        </label>

        <p className="text-xs text-muted">
          ตั้งส่วนลด/ค่าส่งได้ทีหลังในหน้าตั้งค่าบิล หลังเพิ่มผู้จ่ายแล้ว
        </p>

        <SubmitButton>สร้างบิล</SubmitButton>
      </form>
    </div>
  );
}
