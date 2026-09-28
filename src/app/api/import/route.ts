import { NextRequest, NextResponse } from "next/server";
import { importRegisterFile, importClientsFile } from "@/lib/importService";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  const type = formData.get("type");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (type !== "SALES" && type !== "PURCHASE" && type !== "CLIENTS") {
    return NextResponse.json({ error: "Invalid import type." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (type === "CLIENTS") {
      const summary = await importClientsFile(buffer, file.name);
      return NextResponse.json(summary);
    }
    const summary = await importRegisterFile(buffer, file.name, type);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
