import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const logo = settings?.logoPath;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={64} height={64} style={{ objectFit: "contain" }} alt="" />
        ) : (
          <div style={{ fontSize: 40, fontWeight: 700, color: "#0f5c5c" }}>M</div>
        )}
      </div>
    ),
    { ...size }
  );
}
