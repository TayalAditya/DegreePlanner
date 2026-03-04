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
  Users,
  Megaphone
} from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { BrandMark } from "./BrandMark";

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
    { name: "Announcements", href: "/dashboard/admin/announcements", icon: Megaphone },
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
      <nav className="bg-surface/90 border-b border-border/60 no-print sticky top-0 z-50 backdrop-blur-md h-16 shadow-sm">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          {/* Left: Logo */}
          <Link
            href="/dashboard"
            className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <BrandMark size="md" priority />
            <span className="ml-2 text-lg font-bold text-foreground">
              Degree Planner
            </span>
          </Link>

          <div className="flex-1" />

          {/* Right: Notification & Menu Toggle */}
          <div className="flex items-center space-x-2">
            <div className="hidden lg:block">
              <ThemeToggle variant="mode" />
            </div>
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

            <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-surface border-l border-border/60 shadow-xl animate-slide-in flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-surface/50 backdrop-blur-md">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <BrandMark size="sm" priority />
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

            <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide flex flex-col gap-4">
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
                     className={`group relative overflow-hidden flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                       isActive
                         ? "text-primary bg-primary/10 border border-primary/20"
                         : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover border border-transparent"
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

              {/* Appearance — inside scroll area so it doesn't crowd the footer */}
              <div className="border-t border-border/60 pt-4">
                <p className="text-[11px] font-semibold text-foreground-secondary uppercase tracking-wider px-1 mb-2">
                  Appearance
                </p>
                <ThemeToggle variant="full" className="bg-transparent border-0 p-0 shadow-none" />
              </div>
            </div>

            <div className="border-t border-border/60 px-4 py-3 flex items-center gap-3">
              {user.image && (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="w-9 h-9 rounded-full ring-2 ring-border flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-foreground-secondary truncate">{user.email}</p>
              </div>
              <button
                onClick={signOutAndClose}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-foreground-secondary border border-border hover:bg-surface-hover hover:text-foreground transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden xs:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop: Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-72 bg-surface/90 border-r border-border/60 no-print fixed top-16 left-0 h-[calc(100vh-4rem)] backdrop-blur-md overflow-y-auto z-40 shadow-sm">
        <LayoutGroup id="dashboard-nav-desktop">
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scrollbar-hide">
            <div className="px-1">
              <p className="text-[11px] font-semibold text-foreground-secondary uppercase tracking-wider px-2 mb-2">
                Palette
              </p>
              <ThemeToggle variant="palette" className="bg-transparent border-0 p-0 shadow-none" />
            </div>

            <div className="space-y-1">
            {allNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.href);
              return (
               <Link
                   key={item.name}
                   href={item.href}
                   aria-current={isActive ? "page" : undefined}
                   className={`group relative overflow-hidden flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium border transition-all duration-200 no-touch:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                     isActive
                       ? "text-primary bg-primary/10 border-primary/20"
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
          </div>
        </LayoutGroup>

        <div className="border-t border-border/60 px-4 py-4 space-y-3">
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
