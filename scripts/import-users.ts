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
          if (b.includes('computer science') || b.includes('cse') || b.includes('b.tech') && b.includes('computer')) {
            branchCode = 'CSE';
            department = 'School of Computing & Electrical Engineering';
          } else if (b.includes('data science') || b.includes('dse')) {
            branchCode = 'DSE';
            department = 'School of Computing & Electrical Engineering';
          } else if (b.includes('mathematics and computing') || b.includes('mnc')) {
            branchCode = 'MNC';
            department = 'School of Mathematics & Statistical Science';
          } else if (b.includes('microelectronics') || b.includes('vlsi') || b.includes('mevlsi')) {
            branchCode = 'MEVLSI';
            department = 'School of Computing & Electrical Engineering';
          } else if (b.includes('electrical') || b.includes('ee') && !b.includes('ece')) {
            branchCode = 'EE';
            department = 'School of Computing & Electrical Engineering';
          } else if (b.includes('mechanical') || b.includes('me') && !b.includes('mse')) {
            branchCode = 'ME';
            department = 'School of Mechanical and Materials Engineering';
          } else if (b.includes('civil') || b.includes('ce') && !b.includes('ece')) {
            branchCode = 'CE';
            department = 'School of Environmental and Natural Sciences';
          } else if (b.includes('geological') || b.includes('ge') && !b.includes('engineering physics')) {
            branchCode = 'GE';
            department = 'School of Mechanical and Materials Engineering';
          } else if (b.includes('engineering physics') || b.includes('ep')) {
            branchCode = 'EP';
            department = 'School of Physical Sciences';
          } else if (b.includes('bioengineering') || b.includes('biological') || b.includes('be') && !b.includes('mse')) {
            branchCode = 'BE';
            department = 'School of Bioengineering';
          } else if (b.includes('materials science') || b.includes('mse')) {
            branchCode = 'MSE';
            department = 'School of Mechanical and Materials Engineering';
          } else if (b.includes('chemical sciences') || b.includes('chemistry') || b.includes('bs') && b.includes('chemical')) {
            branchCode = 'CS';
            department = 'School of Chemical Sciences';
          } else if (b.includes('electronics') || b.includes('ece')) {
            branchCode = 'ECE';
            department = 'School of Computing & Electrical Engineering';
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
