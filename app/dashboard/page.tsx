import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardOverview } from "@/components/DashboardOverview";
import Link from "next/link";
import { 
  BookOpen, 
  GraduationCap, 
  Calendar, 
  BarChart3, 
  FileText, 
  TrendingUp,
  Award,
  Target,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  const quickActions = [
    {
      title: "Browse Courses",
      description: "Explore available courses and enroll",
      href: "/dashboard/courses",
      icon: BookOpen,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-500/10 to-cyan-500/10",
    },
    {
      title: "View Programs",
      description: "Check your program requirements",
      href: "/dashboard/programs",
      icon: GraduationCap,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-500/10 to-pink-500/10",
    },
    {
      title: "Track Progress",
      description: "Monitor your academic journey",
      href: "/dashboard/progress",
      icon: TrendingUp,
      gradient: "from-green-500 to-emerald-500",
      bgGradient: "from-green-500/10 to-emerald-500/10",
    },
    {
      title: "Plan Timetable",
      description: "Organize your class schedule",
      href: "/dashboard/timetable",
      icon: Calendar,
      gradient: "from-orange-500 to-red-500",
      bgGradient: "from-orange-500/10 to-red-500/10",
    },
  ];

  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-2xl p-8 md:p-12 border border-primary shadow-2xl shadow-primary/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-6 h-6 text-white/90" />
            <span className="text-white/90 font-medium">{getCurrentGreeting()}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {session?.user?.name?.split(" ")[0]}! 👋
          </h1>
          {session?.user?.branch && session?.user?.batch ? (
            <div className="flex flex-wrap gap-3">
              <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <span className="text-white font-semibold">{session.user.branch}</span>
              </div>
              <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <span className="text-white font-semibold">Batch {session.user.batch}</span>
              </div>
              <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <span className="text-white font-semibold">{session.user.enrollmentId}</span>
              </div>
            </div>
          ) : (
            <p className="text-white/90 text-lg">
              Track your academic progress and plan your courses
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Quick Actions</h2>
          <span className="text-sm text-foreground-secondary">Jump to what you need</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group relative overflow-hidden bg-surface rounded-xl border border-border p-6 hover:border-primary transition-all duration-300 hover:shadow-xl hover:scale-105"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${action.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                
                <div className="relative z-10">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-foreground-secondary mb-4">
                    {action.description}
                  </p>
                  <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Get started
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Overview */}
      <DashboardOverview userId={session?.user?.id!} />

      {/* Tips & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="font-semibold text-foreground">Academic Goals</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-foreground-secondary">Complete 160 credits for degree</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-foreground-secondary">Maintain CGPA above 8.0 for honours</span>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <span className="text-foreground-secondary">Complete MTP in final year</span>
            </li>
          </ul>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-purple-500" />
            </div>
            <h3 className="font-semibold text-foreground">Quick Tips</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
              <span className="text-foreground-secondary">Plan your electives based on interests</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-pink-500 rounded-full mt-2 flex-shrink-0"></div>
              <span className="text-foreground-secondary">Check prerequisites before enrolling</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
              <span className="text-foreground-secondary">Track your credit distribution regularly</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
