import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { paymentLabel } from "@/lib/format";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function getRange(mode: string, dateParam?: string) {
  const now = new Date();
  let start: Date;
  let end: Date;
  let key: string;

  if (mode === "yearly") {
    let y = now.getFullYear();
    if (dateParam && /^\d{4}$/.test(dateParam)) {
      y = Number(dateParam);
    }
    start = new Date(y, 0, 1);
    end = new Date(y + 1, 0, 1);
    key = String(y);
  } else if (mode === "monthly") {
    let y = now.getFullYear();
    let m = now.getMonth();
    if (dateParam && /^\d{4}-\d{2}$/.test(dateParam)) {
      const parts = dateParam.split("-").map(Number);
      y = parts[0];
      m = parts[1] - 1;
    }
    start = new Date(y, m, 1);
    end = new Date(y, m + 1, 1);
    key = `${y}-${String(m + 1).padStart(2, "0")}`;
  } else {
    let y = now.getFullYear();
    let m = now.getMonth();
    let d = now.getDate();
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const parts = dateParam.split("-").map(Number);
      y = parts[0];
      m = parts[1] - 1;
      d = parts[2];
    }
    start = new Date(y, m, d);
    end = new Date(y, m, d + 1);
    key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return { start, end, key };
}

export async function GET(req: NextRequest) {
  if (!(await getSession())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "daily";
  const dateParam = req.nextUrl.searchParams.get("date") ?? undefined;
  const { start, end, key } = getRange(mode, dateParam);

  const posts = await prisma.post.findMany({
    where: { createdAt: { gte: start, lt: end }, deletedAt: null },
    include: { owner: true, participants: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  const header = [
    "วันที่",
    "โพส",
    "ผู้สร้าง",
    "ผู้จ่าย",
    "รายการ",
    "ราคา",
    "ส่วนลด",
    "ต้องจ่าย",
    "สถานะ",
  ];

  const rows: string[] = [header.map(csvCell).join(",")];
  for (const post of posts) {
    for (const p of post.participants) {
      rows.push(
        [
          key,
          post.title,
          post.owner.name,
          p.user?.name ?? p.guestName ?? "ยังไม่ระบุคน",
          p.itemName,
          p.price.toFixed(2),
          p.discountShare.toFixed(2),
          p.amountToPay.toFixed(2),
          paymentLabel(p.paymentStatus),
        ]
          .map(csvCell)
          .join(",")
      );
    }
  }

  // Prepend BOM so Excel opens Thai text correctly.
  const body = "\ufeff" + rows.join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="billshere-${key}.csv"`,
    },
  });
}
