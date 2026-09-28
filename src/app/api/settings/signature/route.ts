import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Same storage approach as the logo: a data: URI directly in the DB, not a file on disk —
// serverless hosting has no persistent filesystem.
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.signaturePath) {
    return NextResponse.json({ error: "No signature set." }, { status: 404 });
  }
  const match = /^data:([^;]+);base64,(.+)$/.exec(settings.signaturePath);
  if (!match) {
    return NextResponse.json({ error: "Stored signature is invalid." }, { status: 404 });
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
    return NextResponse.json({ error: "Signature image must be under 2MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, signaturePath: dataUri },
    update: { signaturePath: dataUri },
  });

  return NextResponse.json(settings);
}

export async function DELETE() {
  const settings = await prisma.settings.update({ where: { id: 1 }, data: { signaturePath: null } });
  return NextResponse.json(settings);
}
