import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

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

async function importUsers() {
  try {
    console.log("📊 Reading CSV/Excel file...");

    const dataDir = path.join(process.cwd(), "public", "data");
    let filePath = path.join(dataDir, "approved-students.csv");
    
    if (!fs.existsSync(filePath)) {
      filePath = path.join(dataDir, "approved-students.xlsx");
    }
    
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    let userData: Array<{ rollNumber: string; name?: string; branch?: string }> = [];
    
    if (filePath.endsWith('.csv')) {
      const csvContent = fs.readFileSync(filePath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      const dataLines = lines.slice(2);
      
      userData = dataLines.map(line => {
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        return {
          rollNumber: parts[0] || '',
          name: parts[1] || undefined,
          branch: parts[2] || undefined,
        };
      }).filter(u => u.rollNumber && u.rollNumber.toLowerCase() !== 'roll no.');
    } else {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      userData = data.slice(2).map(row => ({
        rollNumber: String(row[0] || '').trim(),
        name: String(row[1] || '').trim() || undefined,
        branch: String(row[2] || '').trim() || undefined,
      })).filter(u => u.rollNumber);
    }

    console.log(`Found ${userData.length} students\n`);

    await prisma.approvedUser.deleteMany({});
    console.log("🗑️  Cleared existing\n");

    let successCount = 0;
    let errorCount = 0;

    for (const userInfo of userData) {
      try {
        const { batch, enrollmentId } = parseRollNumber(userInfo.rollNumber);
        const email = `${userInfo.rollNumber.toLowerCase()}@students.iitmandi.ac.in`;

        let branchCode = null;
        let department = null;
        
        if (userInfo.branch) {
          const b = userInfo.branch.toLowerCase();
          if (b.includes('chemical') || b.includes('chemistry')) {
            branchCode = 'CHM';
            department = 'School of Basic Sciences';
          } else if (b.includes('physics')) {
            branchCode = 'PHY';
            department = 'School of Basic Sciences';
          } else if (b.includes('math')) {
            branchCode = 'MTH';
            department = 'School of Basic Sciences';
          } else if (b.includes('computer') || b.includes('cse')) {
            branchCode = 'CSE';
            department = 'School of Computing and Electrical Engineering';
          } else if (b.includes('electronics') || b.includes('ece')) {
            branchCode = 'ECE';
            department = 'School of Computing and Electrical Engineering';
          } else if (b.includes('electrical') || b.includes('ee')) {
            branchCode = 'EE';
            department = 'School of Computing and Electrical Engineering';
          } else if (b.includes('mechanical') || b.includes('me')) {
            branchCode = 'ME';
            department = 'School of Mechanical and Materials Engineering';
          } else if (b.includes('civil') || b.includes('ce')) {
            branchCode = 'CE';
            department = 'School of Civil and Environmental Engineering';
          } else if (b.includes('bio')) {
            branchCode = 'BIO';
            department = 'School of Biosciences and Bioengineering';
          }
        }

        await prisma.approvedUser.upsert({
          where: { email },
          update: {
            email,
            enrollmentId,
            name: userInfo.name || null,
            department,
            branch: branchCode,
            batch,
            allowedPrograms: [],
          },
          create: {
            email,
            enrollmentId,
            name: userInfo.name || null,
            department,
            branch: branchCode,
            batch,
            allowedPrograms: [],
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
