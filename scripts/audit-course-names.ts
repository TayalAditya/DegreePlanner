import prisma from "../lib/prisma";

async function main() {
  const courses = await prisma.course.findMany({
    select: { id: true, code: true, name: true, credits: true, department: true },
    orderBy: { code: "asc" },
  });

  console.log(`Total courses: ${courses.length}\n`);

  const issues: { code: string; name: string; reason: string[] }[] = [];

  for (const c of courses) {
    const reasons: string[] = [];
    const name = c.name;

    // Trailing/leading whitespace
    if (name !== name.trim()) reasons.push("leading/trailing whitespace");

    // Multiple consecutive spaces
    if (/  +/.test(name)) reasons.push("multiple consecutive spaces");

    // Ends with a dot
    if (/\.$/.test(name.trim())) reasons.push("ends with dot");

    // Has dots mid-name (not common in course titles — e.g. "Engg. Lab" is fine but "Course..Name" isn't)
    if (/\.\.+/.test(name)) reasons.push("consecutive dots");

    // Has numbers (suspicious if a course name contains digits — usually it shouldn't)
    if (/\d/.test(name)) reasons.push(`contains number(s): ${name.match(/\d+/g)?.join(", ")}`);

    // All caps (shouting)
    if (name === name.toUpperCase() && /[A-Z]{4,}/.test(name)) reasons.push("all caps");

    // Mixed case oddities — starts with lowercase
    if (/^[a-z]/.test(name.trim())) reasons.push("starts with lowercase");

    // Special characters (not letters, numbers, spaces, hyphens, commas, ampersands, parentheses, slashes, apostrophes, dots, colons)
    if (/[^a-zA-Z0-9 \-,&()/'.:\u2013\u2014]/.test(name)) {
      const weird = name.match(/[^a-zA-Z0-9 \-,&()/'.:\u2013\u2014]/g);
      reasons.push(`unusual chars: ${[...new Set(weird)].join(" ")}`);
    }

    // Very short name (likely truncated or placeholder)
    if (name.trim().length < 4) reasons.push("very short name");

    // Placeholder patterns
    if (/^(tbd|tba|n\/a|na|none|placeholder|course \d+|unnamed)$/i.test(name.trim()))
      reasons.push("placeholder name");

    // Ends with comma or semicolon
    if (/[,;]$/.test(name.trim())) reasons.push("ends with comma/semicolon");

    if (reasons.length > 0) {
      issues.push({ code: c.code, name: c.name, reason: reasons });
    }
  }

  if (issues.length === 0) {
    console.log("✅ No issues found!");
    return;
  }

  console.log(`⚠️  Found ${issues.length} courses with issues:\n`);
  console.log(
    `${"Code".padEnd(16)} ${"Issue(s)".padEnd(40)} Name`
  );
  console.log("-".repeat(100));

  for (const issue of issues) {
    console.log(
      `${issue.code.padEnd(16)} ${issue.reason.join(" | ").padEnd(40)} ${issue.name}`
    );
  }

  // Also group by issue type for a summary
  console.log("\n--- Summary by issue type ---");
  const byType: Record<string, number> = {};
  for (const issue of issues) {
    for (const r of issue.reason) {
      const key = r.replace(/:.+$/, "").trim();
      byType[key] = (byType[key] || 0) + 1;
    }
  }
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}x  ${type}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
