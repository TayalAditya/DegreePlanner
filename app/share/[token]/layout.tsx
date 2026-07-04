import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function SharedProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background-secondary to-background">
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-3 min-w-0">
            <BrandMark size="sm" priority />
            <span className="text-sm sm:text-base font-semibold text-foreground truncate">
              Degree Planner - Shared Profile
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-5 text-center text-sm text-foreground-secondary sm:px-6 lg:px-8">
          Degree Planner
        </div>
      </footer>
    </div>
  );
}
