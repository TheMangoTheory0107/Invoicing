"use client";

import { useEffect } from "react";

// Browsers increment/decrement a focused <input type="number"> on mouse-wheel scroll, which is
// almost never what someone scrolling past a form field wants — this blurs the field the moment
// a wheel event reaches it while focused, so scrolling just scrolls the page instead.
export default function DisableNumberInputScroll() {
  useEffect(() => {
    function handleWheel() {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === "number") {
        el.blur();
      }
    }
    document.addEventListener("wheel", handleWheel, { passive: true });
    return () => document.removeEventListener("wheel", handleWheel);
  }, []);

  return null;
}
