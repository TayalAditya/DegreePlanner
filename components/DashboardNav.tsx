"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Calendar,
  FileText,
  GitBranch,
  Info,
  Download,
  LifeBuoy,
  Inbox,
  Users
} from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";

interface DashboardNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
}

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Import Courses", href: "/dashboard/import-courses", icon: Download },
    { name: "Courses", href: "/dashboard/courses", icon: BookOpen },
    { name: "Programs", href: "/dashboard/programs", icon: GraduationCap },
    { name: "Timetable", href: "/dashboard/timetable", icon: Calendar },
    { name: "Progress", href: "/dashboard/progress", icon: BarChart3 },
    { name: "Documents", href: "/dashboard/documents", icon: FileText },
    { name: "Academics", href: "/dashboard/academics", icon: Info },
    { name: "Support", href: "/dashboard/support", icon: LifeBuoy },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  const adminNavigation = [
    { name: "Users", href: "/dashboard/admin", icon: Users },
    { name: "Course Mappings", href: "/dashboard/course-mappings", icon: GitBranch },
    { name: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  ];

  const allNavigation = user.role === "ADMIN"
    ? [...navigation, ...adminNavigation]
    : navigation;

  const isActiveRoute = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const signOutAndClose = () => {
    setMobileMenuOpen(false);
    signOut({ callbackUrl: "/auth/signin" });
  };

  return (
    <>
      {/* Desktop & Mobile: Top Navbar */}
      <nav className="bg-surface/80 border-b border-border no-print sticky top-0 z-50 backdrop-blur-sm h-16">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          {/* Left: Logo (mobile only) */}
          <Link
            href="/dashboard"
            className="lg:hidden flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <GraduationCap className="w-7 h-7 text-primary" />
            <span className="ml-2 text-lg font-bold text-foreground">
              Degree Planner
            </span>
          </Link>

          {/* Center: Theme controls (desktop only) */}
          <div className="hidden lg:flex items-center gap-4 flex-1 px-4 justify-center">
            <ThemeToggle variant="mode" />
            <div className="text-foreground-secondary/30 text-lg">|</div>
            <ThemeToggle variant="palette" className="bg-transparent border-0 p-0 shadow-none" />
          </div>

          {/* Right: Notification & Menu Toggle */}
          <div className="flex items-center space-x-2">
            <NotificationBell />
            {/* Mobile: Menu toggle */}
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden dp-icon-btn"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile: Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 no-print">
          <button
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />

          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-surface border-l border-border shadow-xl animate-slide-in flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/40 backdrop-blur-sm">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <GraduationCap className="w-6 h-6 text-primary" />
                <span className="ml-2 text-base font-bold text-foreground">
                  Degree Planner
                </span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scrollbar-hide">
              <LayoutGroup id="dashboard-nav-mobile">
                <div className="space-y-1">
                  {allNavigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActiveRoute(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative overflow-hidden flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium border transition-all duration-200 no-touch:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
                          isActive
                            ? "text-primary border-transparent"
                            : "bg-card border-border/60 text-foreground-secondary hover:text-foreground hover:bg-surface-hover hover:border-border-strong/60"
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="nav-indicator-mobile"
                            className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20 shadow-sm"
                            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                            aria-hidden="true"
                          />
                        )}
                        <Icon className="w-5 h-5 flex-shrink-0 relative z-10" />
                        <span className="truncate relative z-10">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </LayoutGroup>
            </div>

            <div className="border-t border-border px-4 py-4 space-y-3">
              <div className="flex items-center gap-3">
                {user.image && (
                  <img
                    src={user.image}
                    alt={user.name || "User"}
                    className="w-10 h-10 rounded-full ring-2 ring-border"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                  <p className="text-[10px] text-foreground-secondary truncate">{user.email}</p>
                </div>
              </div>

              <button
                onClick={signOutAndClose}
                className="dp-btn dp-btn-outline w-full"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop: Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-72 bg-surface/80 border-l border-border no-print sticky top-16 h-[calc(100vh-4rem)] backdrop-blur-sm">
        <div className="h-16 flex items-center px-4 border-b border-border">
          <Link
            href="/dashboard"
            className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <GraduationCap className="w-7 h-7 text-primary" />
            <span className="ml-2 text-lg font-bold text-foreground">
              Degree Planner
            </span>
          </Link>
        </div>

        <LayoutGroup id="dashboard-nav-desktop">
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-hide">
            {allNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative overflow-hidden flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium border transition-all duration-200 no-touch:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
                    isActive
                      ? "text-primary border-transparent"
                      : "bg-transparent border-transparent text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-indicator-desktop"
                      className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20 shadow-sm"
                      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="w-5 h-5 flex-shrink-0 relative z-10" />
                  <span className="truncate relative z-10">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </LayoutGroup>

        <div className="border-t border-border px-4 py-4 space-y-3">
          <div className="flex items-center gap-3">
            {user.image && (
              <img
                src={user.image}
                alt={user.name || "User"}
                className="w-9 h-9 rounded-full ring-2 ring-border"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-foreground-secondary truncate">{user.email}</p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="dp-btn dp-btn-outline w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
