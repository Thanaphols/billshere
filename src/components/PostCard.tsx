import Link from "next/link";
import { baht } from "@/lib/format";
import StatusBadge from "./StatusBadge";

export type PostCardData = {
  id: string;
  title: string;
  ownerName: string;
  dateLabel: string;
  total: number;
  count: number;
  paidCount: number;
  myAmount?: number;
  myStatus?: string;
};

export default function PostCard({ post }: { post: PostCardData }) {
  return (
    <Link
      href={`/posts/${post.id}`}
      className="block rounded-2xl bg-surface p-4 shadow-sm active:scale-[.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{post.title}</h3>
          <p className="text-xs text-muted">
            โดย {post.ownerName} · {post.dateLabel}
          </p>
        </div>
        <span className="shrink-0 text-right text-sm font-semibold">
          {baht(post.total)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>
          {post.count} คน · จ่ายแล้ว {post.paidCount}/{post.count}
        </span>
        {post.myStatus ? (
          <span className="flex items-center gap-1">
            ของฉัน {baht(post.myAmount ?? 0)} <StatusBadge status={post.myStatus} />
          </span>
        ) : null}
      </div>
    </Link>
  );
}
