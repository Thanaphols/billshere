import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { paymentLabel } from "@/lib/format";
import { dayRange } from "@/lib/summary";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  if (!(await getSession())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const dateParam = req.nextUrl.searchParams.get("date") ?? undefined;
  const { start, end, key } = dayRange(dateParam);

  const posts = await prisma.post.findMany({
    where: { createdAt: { gte: start, lt: end } },
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
          p.user.name,
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
  const body = "﻿" + rows.join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="billshere-${key}.csv"`,
    },
  });
}
