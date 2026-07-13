import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { paymentLabel } from "@/lib/format";
import { groupByPayer } from "@/lib/discount";

const BKK = { timeZone: "Asia/Bangkok" } as const;
const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("th-TH", {
    ...BKK,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

function getRange(mode: string, dateParam?: string) {
  const now = new Date();
  let start: Date;
  let end: Date;
  let key: string;

  if (mode === "yearly") {
    let y = now.getFullYear();
    if (dateParam && /^\d{4}$/.test(dateParam)) y = Number(dateParam);
    start = new Date(y, 0, 1);
    end = new Date(y + 1, 0, 1);
    key = String(y);
  } else if (mode === "monthly") {
    let y = now.getFullYear();
    let m = now.getMonth();
    if (dateParam && /^\d{4}-\d{2}$/.test(dateParam)) {
      const [yy, mm] = dateParam.split("-").map(Number);
      y = yy;
      m = mm - 1;
    }
    start = new Date(y, m, 1);
    end = new Date(y, m + 1, 1);
    key = `${y}-${String(m + 1).padStart(2, "0")}`;
  } else {
    let y = now.getFullYear();
    let m = now.getMonth();
    let d = now.getDate();
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [yy, mm, dd] = dateParam.split("-").map(Number);
      y = yy;
      m = mm - 1;
      d = dd;
    }
    start = new Date(y, m, d);
    end = new Date(y, m, d + 1);
    key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return { start, end, key };
}

const BRAND = "FF16A34A";
const MONEY = "#,##0.00";

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

  const wb = new ExcelJS.Workbook();
  wb.creator = "billshere";

  // ---- Sheet 1: line items, one row per participant ----
  const ws = wb.addWorksheet("รายการ", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "วันที่-เวลา", key: "dt", width: 22 },
    { header: "บิล", key: "post", width: 22 },
    { header: "ผู้สร้าง", key: "owner", width: 16 },
    { header: "ผู้จ่าย", key: "payer", width: 16 },
    { header: "รายการ", key: "item", width: 30 },
    { header: "ราคา", key: "price", width: 12, style: { numFmt: MONEY } },
    { header: "ส่วนลด", key: "discount", width: 12, style: { numFmt: MONEY } },
    { header: "ต้องจ่าย", key: "amount", width: 12, style: { numFmt: MONEY } },
    { header: "สถานะ", key: "status", width: 14 },
  ];

  let grandPrice = 0;
  let grandDiscount = 0;
  let grandAmount = 0;
  for (const post of posts) {
    for (const p of post.participants) {
      grandPrice += p.price;
      grandDiscount += p.discountShare;
      grandAmount += p.amountToPay;
      ws.addRow({
        dt: fmtDateTime(post.createdAt),
        post: post.title,
        owner: post.owner.name,
        payer: p.user?.name ?? p.guestName ?? "ยังไม่ระบุคน",
        item: p.itemName,
        price: p.price,
        discount: p.discountShare,
        amount: p.amountToPay,
        status: paymentLabel(p.paymentStatus),
      });
    }
  }

  // Header styling
  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Borders + zebra striping on data rows
  const lastRow = ws.rowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    if (r % 2 === 0) {
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F8F4" } };
      });
    }
    row.eachCell((c) => {
      c.border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  }

  if (lastRow >= 2) {
    ws.autoFilter = { from: "A1", to: `I${lastRow}` };
    const total = ws.addRow({
      dt: "",
      post: "",
      owner: "",
      payer: "",
      item: "รวมทั้งหมด",
      price: grandPrice,
      discount: grandDiscount,
      amount: grandAmount,
      status: "",
    });
    total.font = { bold: true };
    total.eachCell((c) => {
      c.border = { top: { style: "double", color: { argb: BRAND } } };
    });
  } else {
    ws.addRow({ dt: "ไม่มีรายการในช่วงที่เลือก" });
  }

  // ---- Sheet 2: summary + in-cell bar chart (data bars) ----
  const sum = wb.addWorksheet("สรุป");
  const bucketLabel =
    mode === "yearly" ? "เดือน" : mode === "monthly" ? "วันที่" : "บิล";

  // Aggregate per the selected view: yearly→by month, monthly→by day, daily→by bill.
  const buckets: { label: string; total: number; count: number }[] = [];
  const idx = new Map<string, number>();
  const bump = (bkey: string, label: string, amt: number) => {
    let i = idx.get(bkey);
    if (i === undefined) {
      i = buckets.length;
      idx.set(bkey, i);
      buckets.push({ label, total: 0, count: 0 });
    }
    buckets[i].total += amt;
    buckets[i].count += 1;
  };
  for (const post of posts) {
    const d = post.createdAt;
    let bkey: string;
    let label: string;
    if (mode === "yearly") {
      bkey = `${d.getFullYear()}-${d.getMonth()}`;
      label = new Intl.DateTimeFormat("th-TH", { ...BKK, month: "short", year: "numeric" }).format(d);
    } else if (mode === "monthly") {
      bkey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      label = new Intl.DateTimeFormat("th-TH", { ...BKK, day: "numeric", month: "short" }).format(d);
    } else {
      bkey = post.id;
      label = post.title;
    }
    for (const p of post.participants) bump(bkey, label, p.amountToPay);
  }

  sum.mergeCells("A1:C1");
  const title = sum.getCell("A1");
  title.value = `สรุปยอด (${key})`;
  title.font = { bold: true, size: 14, color: { argb: BRAND } };

  sum.getRow(3).values = [bucketLabel, "ยอดรวม (บาท)", "จำนวนรายการ"];
  sum.getRow(3).eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.alignment = { horizontal: "center" };
  });
  sum.getColumn(1).width = 26;
  sum.getColumn(2).width = 22;
  sum.getColumn(3).width = 14;

  const firstDataRow = 4;
  for (const b of buckets) {
    const row = sum.addRow([b.label, b.total, b.count]);
    row.getCell(2).numFmt = MONEY;
  }
  const lastDataRow = firstDataRow + buckets.length - 1;

  if (buckets.length > 0) {
    // Native Excel data bars = an in-cell bar chart, no image needed.
    sum.addConditionalFormatting({
      ref: `B${firstDataRow}:B${lastDataRow}`,
      rules: [
        {
          type: "dataBar",
          cfvo: [{ type: "min" }, { type: "max" }],
          color: { argb: BRAND },
          priority: 1,
        } as unknown as ExcelJS.ConditionalFormattingRule,
      ],
    });

    const totalRow = sum.addRow(["รวม", grandAmount, buckets.reduce((s, b) => s + b.count, 0)]);
    totalRow.font = { bold: true };
    totalRow.getCell(2).numFmt = MONEY;
    totalRow.eachCell((c) => {
      c.border = { top: { style: "double", color: { argb: BRAND } } };
    });
  } else {
    sum.addRow(["ไม่มีข้อมูลในช่วงที่เลือก"]);
  }

  // ---- Sheet 3: grouped by payer across the whole period + per-person subtotal ----
  const bp = wb.addWorksheet("ตามผู้จ่าย", { views: [{ state: "frozen", ySplit: 1 }] });
  bp.columns = [
    { header: "บิล", key: "post", width: 22 },
    { header: "รายการ", key: "item", width: 32 },
    { header: "ราคา", key: "price", width: 12, style: { numFmt: MONEY } },
    { header: "ส่วนลด", key: "discount", width: 12, style: { numFmt: MONEY } },
    { header: "ต้องจ่าย", key: "amount", width: 12, style: { numFmt: MONEY } },
  ];
  bp.getRow(1).eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.alignment = { horizontal: "center" };
  });

  const allRows = posts.flatMap((post) =>
    post.participants.map((p) => ({ ...p, postTitle: post.title }))
  );
  const payerGroups = groupByPayer(allRows);
  for (const g of payerGroups) {
    const hr = bp.addRow([g.name]);
    bp.mergeCells(`A${hr.number}:E${hr.number}`);
    hr.getCell(1).font = { bold: true, color: { argb: BRAND } };
    hr.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF6EE" } };

    let sub = 0;
    for (const p of g.items) {
      sub += p.amountToPay;
      bp.addRow({
        post: p.postTitle,
        item: p.itemName,
        price: p.price,
        discount: p.discountShare,
        amount: p.amountToPay,
      });
    }
    const sr = bp.addRow({ item: `รวม ${g.name}`, amount: sub });
    sr.font = { bold: true };
    sr.getCell(5).numFmt = MONEY;
    sr.eachCell((c) => {
      c.border = { top: { style: "thin", color: { argb: BRAND } } };
    });
  }
  if (payerGroups.length === 0) bp.addRow(["ไม่มีข้อมูลในช่วงที่เลือก"]);

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="billshere-${key}.xlsx"`,
    },
  });
}
