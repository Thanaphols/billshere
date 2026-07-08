import { createPost } from "@/actions/posts";
import SubmitButton from "@/components/SubmitButton";

export default function NewPostPage() {
  return (
    <div>
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
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">โน้ต (ไม่บังคับ)</span>
          <input
            name="note"
            placeholder="รายละเอียดเพิ่มเติม"
            className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">แบบส่วนลด</span>
            <select
              name="discountType"
              defaultValue="NONE"
              className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand"
            >
              <option value="NONE">ไม่มี</option>
              <option value="FIXED">รวม (บาท) ÷ เท่ากัน</option>
              <option value="PERCENT">เปอร์เซ็นต์</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">ค่าส่วนลด</span>
            <input
              name="discountValue"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand"
            />
          </label>
        </div>

        <p className="text-xs text-muted">
          FIXED = ส่วนลดรวมหารเท่ากันทุกคน (เช่น 70 ÷ 8 = 8.75) · PERCENT = ลด
          %ของราคาแต่ละคน
        </p>

        <SubmitButton>สร้างบิล</SubmitButton>
      </form>
    </div>
  );
}
