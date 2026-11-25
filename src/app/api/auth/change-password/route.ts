import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Protected by the session middleware same as every other /api route — you must already be
// logged in (with the current password) to reach this at all, on top of the explicit current-
// password check below.
export async function POST(req: NextRequest) {
  const { currentPassword, newPassword } = await req.json();

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "Both fields are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: 1 } });
  if (!user) {
    return NextResponse.json({ error: "No account set up yet." }, { status: 400 });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: 1 }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
