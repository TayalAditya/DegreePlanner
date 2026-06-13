import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const FEMALE_NAMES = new Set([
  "priya","sunita","meena","anita","kavita","rekha","shilpa","pooja","puja","neha","ritu","nisha",
  "asha","usha","lata","geeta","gita","seema","sima","sonia","sonya","divya","deepa","dipa",
  "manisha","manasa","vandana","archana","kalpana","rashmi","madhu","manju","manjula","saroj",
  "savita","sushma","shweta","shreya","shruti","swati","smita","suman","sudha","supriya","sushmita",
  "tanvi","tanya","trisha","uma","vidya","vineeta","vinita","vidhya","yamini","yasmin","zara",
  "akansha","akanksha","ankita","ambika","amita","amrita","ananya","anamika","anjali","anuradha",
  "anushka","aparajita","aparna","arati","aarti","aaradhya","aradhana","aruna","avani","babita",
  "bhavana","chandni","chandra","deepika","deeksha","diksha","durga","ekta","garima","gayatri",
  "geetanjali","hema","himani","indira","ishita","jyoti","jyotsna","kajal","kamla","kiran",
  "komal","kritika","kusum","lalita","lavanya","leela","leelavathi","madhumita","mahima","malvika",
  "mamta","manorama","meenakshi","megha","mona","monika","namrata","nandita","nandini","namita",
  "natasha","niharika","nilima","nita","nitu","padma","pallavi","parvati","payal","poonam","poornima",
  "prachi","pragati","pratibha","preeti","preethi","prerna","prerana","pushpa","radha","radhika",
  "ranjana","ratna","reena","rina","riya","rohini","roshni","rucha","rupa","rupal","sadhana",
  "sagarika","sangeeta","sangita","sanjana","sanjna","sapna","saraswati","sarla","shalini","shanta",
  "sharada","sharda","shikha","shipra","shirin","shobha","shradha","shraddha","shubha","silpa",
  "simran","sneha","snigdha","soumya","sridevi","subha","subhadra","subhashini","sulekha","sulochana",
  "sunanda","suparna","surekha","susheela","sushila","tara","taruna","urvashi","urvasi",
  "vaishali","varsha","vasudha","veena","vibha","vijaya","vijayalakshmi","vimala","vina","vrinda",
  "yashoda","yogita","zoya","noor","aisha","fatima","sana","sara","sarah","maria","alice","grace",
  "linda","lisa","helen","anna","emma","sophia","olivia","emily","charlotte","isabella",
  // extras from this list
  "aditi","arpita","doyel","dhanya","garima","indu","moupriya","moumita","mousumi","needhi",
  "parimala","preeti","preti","qaiser","rakhi","riya","sreelakshmi","sneha","swati","aliva",
  "archi","anshu","rik","rani","neethi","ridhi","saumya","shyamasree","rajeshwari",
]);

const MALE_ENDINGS = ["kumar","raj","singh","pal","ram","esh","ish","ush","ant","ash","ar","er","or","ul","al","il","on","an","en","in"];

function inferGender(instructorName) {
  if (!instructorName) return "Unknown";
  const stripped = instructorName.replace(/\b(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?)\s*/gi, "").trim();
  // take first name only (before space or comma or &)
  const firstName = stripped.split(/[\s,&(]/)[0].toLowerCase().replace(/[^a-z]/g, "");
  if (!firstName) return "Unknown";
  if (FEMALE_NAMES.has(firstName)) return "F";
  if (MALE_ENDINGS.some(e => firstName.endsWith(e))) return "M";
  if (firstName.endsWith("a") || firstName.endsWith("i") || firstName.endsWith("ee")) return "F";
  return "?";
}

const prisma = new PrismaClient();

const rows = await prisma.courseOffering.findMany({
  where: { isActive: true, instructor: { not: null } },
  select: { instructor: true, school: true, courseCode: true, courseName: true },
  orderBy: { instructor: "asc" },
});
await prisma.$disconnect();

// dedupe by instructor name
const seen = new Set();
const unique = [];
for (const r of rows) {
  if (seen.has(r.instructor)) continue;
  seen.add(r.instructor);
  unique.push(r);
}

const wsData = [
  ["Include", "Gender (M/F/?)", "Instructor Name", "School / Course"],
  ...unique.map(r => [
    true,
    inferGender(r.instructor),
    r.instructor,
    `${r.school ?? ""} — ${r.courseCode} ${r.courseName}`,
  ]),
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(wsData);

// Column widths
ws["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 40 }, { wch: 60 }];

XLSX.utils.book_append_sheet(wb, ws, "Instructors");
XLSX.writeFile(wb, "scripts/instructors-review.xlsx");
console.log(`Exported ${unique.length} instructors to scripts/instructors-review.xlsx`);
