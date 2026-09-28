import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Stored as a data: URI directly in the DB (Settings.logoPath) rather than a file on disk —
// serverless hosting (Vercel) has no persistent filesystem, so a file written here would
// vanish on the next request. react-pdf's <Image> accepts a data URI as `src` directly, so
// this needs no extra handling on the PDF side.
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.logoPath) {
    return NextResponse.json({ error: "No logo set." }, { status: 404 });
  }
  const match = /^data:([^;]+);base64,(.+)$/.exec(settings.logoPath);
  if (!match) {
    return NextResponse.json({ error: "Stored logo is invalid." }, { status: 404 });
  }
  const [, contentType, base64] = match;
  return new NextResponse(new Uint8Array(Buffer.from(base64, "base64")), {
    headers: { "Content-Type": contentType },
  });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Please upload a PNG, JPG, or SVG image." },
      { status: 400 }
    );
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Logo must be under 2MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, logoPath: dataUri },
    update: { logoPath: dataUri },
  });

  return NextResponse.json(settings);
}

export async function DELETE() {
  const settings = await prisma.settings.update({ where: { id: 1 }, data: { logoPath: null } });
  return NextResponse.json(settings);
}
