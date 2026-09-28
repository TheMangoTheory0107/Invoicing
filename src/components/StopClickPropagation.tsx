"use client";

// Wraps a cell's own link/button (e.g. an external Drive link) inside a ClickableRow so
// clicking it doesn't also trigger the row's own navigation.
export default function StopClickPropagation({ children }: { children: React.ReactNode }) {
  return <span onClick={(e) => e.stopPropagation()}>{children}</span>;
}
