import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const existing = await prisma.user.findUnique({ where: { id: 1 } });
  if (existing) {
    return NextResponse.json(
      { error: "Account already set up. Please log in." },
      { status: 400 }
    );
  }

  const { password } = await req.json();
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { id: 1, passwordHash } });

  const session = await getSession();
  session.loggedIn = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
