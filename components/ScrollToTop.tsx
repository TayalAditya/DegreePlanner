"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { usePathname } from "next/navigation";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const isPreRegistration = pathname === "/dashboard/pre-registration";

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed ${isPreRegistration ? "bottom-[11.5rem] sm:bottom-[8.5rem] lg:bottom-6" : "bottom-6"} right-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))] z-40 inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-95 transition-opacity duration-150`}
      aria-label="Scroll to top"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
