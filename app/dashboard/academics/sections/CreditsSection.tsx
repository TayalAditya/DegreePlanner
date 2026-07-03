import { MTP_COMPONENT_CREDITS, MTP_TOTAL_CREDITS } from "@/lib/mtpConfig";

export default function CreditsSection() {
  const branches = [
    { name: "Bio-Engineering", dc: 42, de: 24, total: 66 },
    { name: "Civil Engineering", dc: 49, de: 17, total: 66 },
    { name: "Computer Science", dc: 38, de: 28, total: 66 },
    { name: "Data Science", dc: 33, de: 33, total: 66 },
    { name: "Electrical Engineering", dc: 52, de: 20, total: 72 },
    { name: "Engineering Physics", dc: 37, de: 29, total: 66 },
    { name: "General Engineering", dc: 36, de: 30, total: 66 },
    { name: "Material Science", dc: 45, de: 21, total: 66 },
    { name: "Mathematics & Computing", dc: 51, de: 15, total: 66 },
    { name: "Mechanical Engineering", dc: 50, de: 16, total: 66 },
    { name: "Microelectronics & VLSI", dc: 54, de: 12, total: 66 },
    { name: "Chemical Sciences (B.S.)", dc: 59, de: 23, total: 82 },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Discipline Core & Electives by Branch</h3>
        <div className="-mx-6 overflow-x-auto px-6 scrollbar-hide">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Branch</th>
                <th className="text-right p-3">Discipline Core</th>
                <th className="text-right p-3">Discipline Electives</th>
                <th className="text-right p-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch, idx) => (
                <tr key={idx} className="border-b hover:bg-surface-hover/70 transition-colors">
                  <td className="p-3">{branch.name}</td>
                  <td className="text-right p-3 text-blue-600 dark:text-blue-400 font-semibold">{branch.dc}</td>
                  <td className="text-right p-3 text-purple-600 dark:text-purple-400 font-semibold">{branch.de}</td>
                  <td className="text-right p-3 font-bold">{branch.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-xl mb-4">ISTP & MTP</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">ISTP (4 credits)</h4>
              <p className="text-sm text-muted-foreground">
                Interactive Socio-Technical Practicum - 6th Semester practicum involving development of useful products and technologies with understanding of socio-economic context.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-purple-600 dark:text-purple-400 mb-2">MTP ({MTP_TOTAL_CREDITS} credits total)</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Major Technical Project - Final year project under faculty supervision
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• MTP-1: {MTP_COMPONENT_CREDITS} credits (branch-498P)</li>
                <li>• MTP-2: {MTP_COMPONENT_CREDITS} credits (branch-499P)</li>
                <li>• Minimum GP 7.0 in MTP-1 to continue to MTP-2</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-xl mb-4">Pass/Fail & Audit Courses</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Pass/Fail Courses</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Grades: Pass (P) or Fail (F)</li>
                <li>• Count towards B.Tech requirement</li>
                <li>• Maximum 9 P/F credits total</li>
                <li>• Not more than 6 in a semester</li>
                <li>• Don&apos;t affect CGPA</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-purple-600 dark:text-purple-400 mb-2">Audit Courses</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Grades: Audit Pass (AP) or Audit Fail (AF)</li>
                <li>• Don&apos;t count towards requirements</li>
                <li>• No credit limit</li>
                <li>• Don&apos;t affect CGPA</li>
                <li>• Good for workshops/conferences</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
