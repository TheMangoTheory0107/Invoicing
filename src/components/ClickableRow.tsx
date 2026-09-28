"use client";

import { useRouter } from "next/navigation";

// Makes a whole table row navigate to `href` on click, not just the link inside one cell —
// used across every invoice list/register so clicking anywhere in the row opens it.
export default function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr onClick={() => router.push(href)} className={`cursor-pointer ${className || ""}`}>
      {children}
    </tr>
  );
}
