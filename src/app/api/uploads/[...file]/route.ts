import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getSession } from "@/lib/auth";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

const CONTENT_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string[] }> }
) {
  // Slips are private — require a logged-in session.
  if (!(await getSession())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { file } = await params;
  const name = path.basename(file.join("/")); // strip any path traversal
  const ext = path.extname(name).toLowerCase();
  if (!CONTENT_TYPE[ext]) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, name));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPE[ext],
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
