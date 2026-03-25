import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { getDepartmentForBranch, getProgramLookupBranchCode, inferBranchFromProgram } from "../lib/branchInfo";

const prisma = new PrismaClient();

function parseRollNumber(rollNumber: string) {
  const cleaned = rollNumber.toLowerCase().trim();
  const yearMatch = cleaned.match(/^b(\d{2})/);
  const batch = yearMatch ? 2000 + parseInt(yearMatch[1]) : undefined;
  
  return {
    batch,
    enrollmentId: rollNumber.toUpperCase(),
  };
}

type ImportedUser = {
  rollNumber: string;
  name?: string;
  branch?: string;
};

function loadPrimaryApprovedUsers(): ImportedUser[] {
  const dataDir = path.join(process.cwd(), "public", "data");
  let filePath = path.join(dataDir, "approved-students.csv");

  if (!fs.existsSync(filePath)) {
    filePath = path.join(dataDir, "approved-students.xlsx");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error("File not found");
  }

  if (filePath.endsWith(".csv")) {
    const csvContent = fs.readFileSync(filePath, "utf-8");
    const lines = csvContent.split("\n").filter((line) => line.trim());
    const dataLines = lines.slice(2);

    return dataLines
      .map((line) => {
        const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
        return {
          rollNumber: parts[0] || "",
          name: parts[1] || undefined,
          branch: parts[2] || undefined,
        };
      })
      .filter((user) => user.rollNumber && user.rollNumber.toLowerCase() !== "roll no.");
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  return data
    .slice(2)
    .map((row) => ({
      rollNumber: String(row[0] || "").trim(),
      name: String(row[1] || "").trim() || undefined,
      branch: String(row[2] || "").trim() || undefined,
    }))
    .filter((user) => user.rollNumber);
}

function loadBatch25Users(): ImportedUser[] {
  const filePath = path.join(process.cwd(), "docs", "b25 students.xlsx");
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];

  return data
    .slice(1)
    .map((row) => ({
      rollNumber: String(row[0] || "").trim(),
      name: String(row[1] || "").trim() || undefined,
      branch: String(row[2] || "").trim() || undefined,
    }))
    .filter((user) => /^B25\d+$/i.test(user.rollNumber));
}

function mergeUsers(primaryUsers: ImportedUser[], batch25Users: ImportedUser[]): ImportedUser[] {
  const merged = new Map<string, ImportedUser>();

  for (const user of primaryUsers) {
    merged.set(user.rollNumber.toUpperCase(), user);
  }

  // Batch 25 roster is authoritative for branch/name if present.
  for (const user of batch25Users) {
    merged.set(user.rollNumber.toUpperCase(), user);
  }

  return Array.from(merged.values());
}

async function importUsers() {
  try {
    console.log("📊 Reading approved users + Batch 25 roster...");

    const primaryUsers = loadPrimaryApprovedUsers();
    const batch25Users = loadBatch25Users();
    const userData = mergeUsers(primaryUsers, batch25Users);

    console.log(`Found ${userData.length} students\n`);
    if (batch25Users.length > 0) {
      console.log(`Included ${batch25Users.length} Batch 25 students from docs/b25 students.xlsx\n`);
    }


    let successCount = 0;
    let errorCount = 0;

    for (const userInfo of userData) {
      try {
        const { batch, enrollmentId } = parseRollNumber(userInfo.rollNumber);
        const email = `${userInfo.rollNumber.toLowerCase()}@students.iitmandi.ac.in`;
        const branchCode = inferBranchFromProgram(userInfo.branch) || null;
        const department = getDepartmentForBranch(branchCode);
        const allowedPrograms = branchCode ? [getProgramLookupBranchCode(branchCode)] : [];

        await prisma.approvedUser.upsert({
          where: { email },
          update: {
            email,
            enrollmentId,
            name: userInfo.name || null,
            department,
            branch: branchCode,
            batch,
            allowedPrograms,
          },
          create: {
            email,
            enrollmentId,
            name: userInfo.name || null,
            department,
            branch: branchCode,
            batch,
            allowedPrograms,
          },
        });

        console.log(`✅ ${email} | ${userInfo.name || 'No name'} | ${branchCode || 'No branch'}`);
        successCount++;
      } catch (error) {
        console.error(`❌ ${userInfo.rollNumber}`);
        errorCount++;
      }
    }

    console.log(`\n✅ Done! Success: ${successCount}, Errors: ${errorCount}`);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

importUsers()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
