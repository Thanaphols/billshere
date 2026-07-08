/** Compute a local-time [start, end) range for a given YYYY-MM-DD (default today). */
export function dayRange(dateParam?: string): {
  start: Date;
  end: Date;
  key: string;
} {
  let base: Date;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [y, m, d] = dateParam.split("-").map(Number);
    base = new Date(y, m - 1, d);
  } else {
    const now = new Date();
    base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const start = new Date(base);
  const end = new Date(base);
  end.setDate(end.getDate() + 1);

  const key = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(
    start.getDate()
  )}`;
  return { start, end, key };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
