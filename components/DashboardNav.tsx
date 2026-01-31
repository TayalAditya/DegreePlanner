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
  FileText
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

interface DashboardNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Courses", href: "/dashboard/courses", icon: BookOpen },
    { name: "Programs", href: "/dashboard/programs", icon: GraduationCap },
    { name: "Timetable", href: "/dashboard/timetable", icon: Calendar },
    { name: "Progress", href: "/dashboard/progress", icon: BarChart3 },
    { name: "Documents", href: "/dashboard/documents", icon: FileText },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <nav className="bg-surface dark:bg-surface border-b border-border no-print sticky top-0 z-50 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/dashboard" className="flex items-center">
              <GraduationCap className="w-7 h-7 text-primary" />
              <span className="ml-2 text-lg font-bold text-foreground hidden sm:block">
                Degree Planner
              </span>
            </Link>

            <div className="hidden lg:ml-8 lg:flex lg:space-x-4">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-primary text-foreground"
                        : "border-transparent text-foreground-secondary hover:border-border hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    <span className="hidden xl:inline">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="hidden lg:ml-6 lg:flex lg:items-center space-x-3">
            <ThemeToggle />
            <div className="flex items-center pl-3 border-l border-border">
              {user.image && (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="w-8 h-8 rounded-full ring-2 ring-border"
                />
              )}
              <div className="ml-3 hidden xl:block">
                <p className="text-sm font-medium text-foreground truncate max-w-[150px]">{user.name}</p>
                <p className="text-xs text-foreground-secondary truncate max-w-[150px]">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="inline-flex items-center px-3 py-2 border border-border text-sm font-medium rounded-md text-foreground-secondary hover:bg-background-secondary transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden xl:inline">Sign Out</span>
            </button>
          </div>

          <div className="flex items-center lg:hidden space-x-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-foreground-secondary hover:text-foreground hover:bg-background-secondary"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-surface dark:bg-surface">
          <div className="pt-2 pb-3 space-y-1 px-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive
                      ? "bg-primary bg-opacity-10 dark:bg-opacity-20 text-primary"
                      : "text-foreground-secondary hover:bg-background-secondary hover:text-foreground"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </div>
          <div className="pt-4 pb-3 border-t border-border">
            <div className="flex items-center px-5">
              {user.image && (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="w-10 h-10 rounded-full ring-2 ring-border"
                />
              )}
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-base font-medium text-foreground truncate">{user.name}</p>
                <p className="text-sm text-foreground-secondary truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 px-2 space-y-1">
              <button
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                className="flex items-center w-full px-3 py-2 rounded-md text-base font-medium text-foreground-secondary hover:text-foreground hover:bg-background-secondary"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
