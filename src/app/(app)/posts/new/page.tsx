import { createPost } from "@/actions/posts";
import SubmitButton from "@/components/SubmitButton";
import DiscountFields from "@/components/DiscountFields";

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

        <DiscountFields />

        <SubmitButton>สร้างบิล</SubmitButton>
      </form>
    </div>
  );
}
