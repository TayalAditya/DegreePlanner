import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { CourseDiff } from "@/components/CourseDiff";
import {
  SharedProfileView,
  type SharedCategoryProgress,
  type SharedCourseRow,
  type SharedSemesterCredit,
} from "@/components/SharedProfileView";
import { authOptions } from "@/lib/auth";
import { getBranchCandidates, getCurriculumBranchCode } from "@/lib/branchInfo";
import { resolveBaseCategory } from "@/lib/courseCategory";
import { loadDashboardEnrollments } from "@/lib/enrollmentsQuery";
import {
  type CategoryCreditBreakdown,
  computeEnrollmentCreditBreakdown,
} from "@/lib/progressCreditBreakdown";
import { getMtpComponent, MTP_COMPONENT_CREDITS, MTP_TOTAL_CREDITS } from "@/lib/mtpConfig";
import prisma from "@/lib/prisma";
import { addCredits, formatCourseCode } from "@/lib/utils";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

type DashboardEnrollment = Awaited<ReturnType<typeof loadDashboardEnrollments>>[number];

type ProfileUser = {
  id: string;
  name: string | null;
  branch: string | null;
  batch: number | null;
  doingMTP: boolean;
  doingMTP2: boolean;
  doingISTP: boolean;
  enrollmentId: string | null;
};

type ProgramCreditFields = {
  totalCreditsRequired: number;
  icCredits: number;
  dcCredits: number;
  deCredits: number;
  feCredits: number;
  mtpIstpCredits: number;
};

type CategoryKey = keyof CategoryCreditBreakdown;

const categoryOrder: CategoryKey[] = [
  "IC",
  "IC_BASKET",
  "DC",
  "DE",
  "FE",
  "HSS",
  "MTP",
  "ISTP",
  "NOT_IN_DEGREE",
];

const categoryLabels: Record<CategoryKey, string> = {
  IC: "Institute Core",
  IC_BASKET: "IC Basket",
  DC: "Discipline Core",
  DE: "Discipline Electives",
  FE: "Free Electives",
  HSS: "Humanities and IKS",
  IKS: "Indian Knowledge System",
  MTP: "Major Technical Project",
  ISTP: "ISTP",
  NOT_IN_DEGREE: "Not in Degree",
};

function isCountedCompleted(enrollment: DashboardEnrollment) {
  return enrollment.status === "COMPLETED" && (!enrollment.grade || enrollment.grade !== "F");
}

function resolveCourseCategory(
  enrollment: DashboardEnrollment,
  userBranch?: string | null,
  userBatch?: number | null
): CategoryKey {
  const courseCode = enrollment.course?.code ?? "";

  // Internships / 396P|399P are always Free Elective on the shared profile.
  if (enrollment.isInternship || /39[69]P$/i.test(courseCode)) return "FE";

  // Table-first resolution via the shared resolver (lib/courseCategory.ts).
  const base = resolveBaseCategory(
    {
      code: courseCode,
      courseType: enrollment.courseType,
      branchMappings: enrollment.course?.branchMappings ?? undefined,
    },
    userBranch,
    userBatch
  );

  // Map the shared base categories onto this page's CategoryKey set (no PE bucket here;
  // this page has no stateful IC-basket, so any ICB candidate simply shows as IC_BASKET).
  if (base === "IC_BASKET_CANDIDATE") return "IC_BASKET";
  if (base === "PE") return "FE";
  return base as CategoryKey;
}

function buildCourseRows(
  enrollments: DashboardEnrollment[],
  userBranch?: string | null,
  userBatch?: number | null
): SharedCourseRow[] {
  return enrollments.map((enrollment) => ({
    semester: enrollment.semester,
    code: formatCourseCode(enrollment.course?.code ?? ""),
    name: enrollment.course?.name ?? "Untitled course",
    credits: Number(enrollment.course?.credits ?? 0),
    category: resolveCourseCategory(enrollment, userBranch, userBatch),
  }));
}

function buildSemesterCredits(enrollments: DashboardEnrollment[]): SharedSemesterCredit[] {
  const bySemester = new Map<number, number>();

  enrollments.filter(isCountedCompleted).forEach((enrollment) => {
    bySemester.set(
      enrollment.semester,
      addCredits(bySemester.get(enrollment.semester) ?? 0, enrollment.course?.credits ?? 0)
    );
  });

  return Array.from(bySemester.entries())
    .map(([semester, credits]) => ({ semester, credits }))
    .sort((a, b) => a.semester - b.semester);
}

function buildRequiredCredits(
  program: ProgramCreditFields | null | undefined,
  user: ProfileUser,
  enrollments: DashboardEnrollment[],
  categoryCredits: CategoryCreditBreakdown
) {
  const inferredBatch =
    user.batch ??
    (() => {
      const match = /B(\d{2})/i.exec(user.enrollmentId ?? "");
      return match ? 2000 + Number.parseInt(match[1], 10) : null;
    })();
  const isBatch22 = inferredBatch === 2022;
  const isBSProgram = getCurriculumBranchCode(user.branch || "") === "BSCS";
  const hssRequired = (program?.icCredits ?? 60) <= 52 ? 12 : 15;
  const icBasketRequired = 6;

  const completedMtpComponents = new Set(
    enrollments
      .filter(isCountedCompleted)
      .map((enrollment) => getMtpComponent(enrollment.course?.code ?? ""))
      .filter((component): component is 1 | 2 => component !== null)
  );
  const mtp1Completed = completedMtpComponents.has(1);
  const mtp2Completed = completedMtpComponents.has(2);
  const istpCompleted = categoryCredits.ISTP >= 4;

  const doingMTP1Pref = user.doingMTP ?? true;
  const doingMTP2Pref = user.doingMTP2 ?? true;
  const doingISTPPref = user.doingISTP ?? true;

  let mtpRequired = MTP_TOTAL_CREDITS;
  let istpRequired = isBSProgram ? 0 : 4;
  let deAdjustment = 0;
  let feAdjustment = 0;

  if (!isBSProgram && !istpCompleted && !doingISTPPref) {
    istpRequired = 0;
    if (isBatch22) {
      deAdjustment += 3;
      feAdjustment += 1;
    } else {
      feAdjustment += 4;
    }
  }

  if (!doingMTP1Pref && !mtp1Completed) {
    mtpRequired = Math.max(0, mtpRequired - MTP_COMPONENT_CREDITS);
    deAdjustment += MTP_COMPONENT_CREDITS;
  }

  if (!doingMTP2Pref && !mtp2Completed) {
    mtpRequired = Math.max(0, mtpRequired - MTP_COMPONENT_CREDITS);
    deAdjustment += MTP_COMPONENT_CREDITS;
  }

  return {
    IC: Math.max(0, (program?.icCredits ?? 60) - icBasketRequired - hssRequired),
    IC_BASKET: icBasketRequired,
    DC: program?.dcCredits ?? 0,
    DE: (program?.deCredits ?? 0) + deAdjustment,
    FE: (program?.feCredits ?? 0) + feAdjustment,
    HSS: hssRequired,
    IKS: 0,
    MTP: mtpRequired,
    ISTP: istpRequired,
    NOT_IN_DEGREE: 0,
  } satisfies CategoryCreditBreakdown;
}

function buildCategoryProgress(
  categoryCredits: CategoryCreditBreakdown,
  requiredCredits: CategoryCreditBreakdown
): SharedCategoryProgress[] {
  return categoryOrder
    .map((key) => ({
      key,
      label: categoryLabels[key],
      completed: categoryCredits[key],
      required: requiredCredits[key],
    }))
    .filter((category) => category.required > 0 || category.completed > 0);
}

function RestrictedAccess() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="max-w-md rounded-xl border border-warning/30 bg-warning/5 p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-warning/20 bg-warning/10">
          <AlertTriangle className="h-6 w-6 text-warning" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Access restricted to IIT Mandi students
        </h1>
        <p className="mt-2 text-sm text-foreground-secondary">
          Use a students.iitmandi.ac.in Google account to view this shared profile.
        </p>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const profileUser = await prisma.user.findFirst({
    where: { shareToken: token, isProfileShared: true },
    select: { name: true },
  });

  const profileName = profileUser?.name || "Student";

  return {
    title: `${profileName}'s Academic Profile - Degree Planner`,
    description: "Shared academic progress from Degree Planner",
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const profileUser = await prisma.user.findFirst({
    where: { shareToken: token, isProfileShared: true },
    select: {
      id: true,
      name: true,
      branch: true,
      batch: true,
      doingMTP: true,
      doingMTP2: true,
      doingISTP: true,
      enrollmentId: true,
    },
  });

  if (!profileUser) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    const callbackUrl = `/share/${encodeURIComponent(token)}`;
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const viewerEmail = session.user.email?.toLowerCase() ?? "";
  if (!viewerEmail.endsWith("@students.iitmandi.ac.in")) {
    return <RestrictedAccess />;
  }

  const [profileEnrollments, primaryProgram, viewerUser] = await Promise.all([
    loadDashboardEnrollments(profileUser.id),
    prisma.userProgram.findFirst({
      where: { userId: profileUser.id, isPrimary: true },
      include: { program: true },
    }),
    session.user.id
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: { id: true, branch: true, batch: true },
        })
      : null,
  ]);

  const program = primaryProgram?.program ?? null;
  const creditBreakdown = computeEnrollmentCreditBreakdown({
    enrollments: profileEnrollments,
    userBranch: profileUser.branch,
    userBatch: profileUser.batch,
    programIcCredits: program?.icCredits,
    requiredDE: program?.deCredits ?? 0,
  });
  const requiredCredits = buildRequiredCredits(
    program,
    profileUser,
    profileEnrollments,
    creditBreakdown.categoryCredits
  );
  const profileCourseRows = buildCourseRows(profileEnrollments, profileUser.branch, profileUser.batch);
  const semesterCredits = buildSemesterCredits(profileEnrollments);
  const totalCreditsRequired = program?.totalCreditsRequired ?? 160;
  const totalCreditsEarned = creditBreakdown.counted.total;
  const sameBranch =
    Boolean(profileUser.branch) && Boolean(viewerUser?.branch) && profileUser.branch === viewerUser?.branch;

  const viewerCourseRows =
    sameBranch && viewerUser?.id
      ? buildCourseRows(
          await loadDashboardEnrollments(viewerUser.id),
          viewerUser.branch,
          viewerUser.batch
        )
      : [];

  return (
    <SharedProfileView
      profile={{
        name: profileUser.name || "Student",
        branch: profileUser.branch,
        batch: profileUser.batch,
      }}
      totalCreditsEarned={totalCreditsEarned}
      totalCreditsRequired={totalCreditsRequired}
      categoryProgress={buildCategoryProgress(creditBreakdown.categoryCredits, requiredCredits)}
      semesterCredits={semesterCredits}
      courses={profileCourseRows}
      diff={
        sameBranch ? (
          <CourseDiff
            profileName={profileUser.name || "They"}
            profileCourses={profileCourseRows}
            viewerCourses={viewerCourseRows}
          />
        ) : null
      }
    />
  );
}
