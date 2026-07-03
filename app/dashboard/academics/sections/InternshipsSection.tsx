import { CheckCircle } from "lucide-react";

export default function InternshipsSection() {
  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Mandatory Internship</h3>
        <div className="space-y-3">
          <p className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span>Compulsory for all students</span>
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span>Minimum 6 weeks duration</span>
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span>Worth 2 credits (Pass/Fail)</span>
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span>To be done after 5th semester</span>
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span>Must be completed before final semester</span>
          </p>
        </div>
        <div className="mt-4 p-4 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30">
          <h4 className="font-semibold mb-2">Types of Internships</h4>
          <ul className="space-y-1 text-sm">
            <li>• <strong>Industrial:</strong> Industrial experience</li>
            <li>• <strong>Research:</strong> Research-oriented (industry/academia)</li>
            <li>• <strong>Academic:</strong> Under professors of other institutes</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-xl mb-4 text-blue-600 dark:text-blue-400">Semester Long Remote Internship</h3>
          <div className="space-y-3 text-sm">
            <p className="font-semibold">Course Code: DP-396P</p>
            <p><strong>Credits:</strong> 6 P/F (Free Electives)</p>
            <p><strong>Duration:</strong> Minimum 14 weeks</p>
            <p><strong>Semesters:</strong> 6th, 7th, or 8th</p>
            <p><strong>Courses Allowed:</strong> Max 9 credits alongside</p>
            <div className="mt-4 p-3 rounded-lg bg-accent/10 dark:bg-accent/15 border border-border/60">
              <p className="font-semibold">Requirements:</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• FA approval required</li>
                <li>• NOC from Academic Section</li>
                <li>• Before add/drop deadline</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-xl mb-4 text-purple-600 dark:text-purple-400">Semester Long Onsite Internship</h3>
          <div className="space-y-3 text-sm">
            <p className="font-semibold">Course Code: DP-399P</p>
            <p><strong>Credits:</strong> 9 P/F (Free Electives)</p>
            <p><strong>Duration:</strong> Minimum 14 weeks</p>
            <p><strong>Semesters:</strong> 6th or 7th (8th needs Dean approval)</p>
            <p><strong>Courses Allowed:</strong> None during internship</p>
            <div className="mt-4 p-3 rounded-lg bg-accent/10 dark:bg-accent/15 border border-border/60">
              <p className="font-semibold">Requirements:</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• FA approval required</li>
                <li>• NOC from Academic Section</li>
                <li>• Before add/drop deadline</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-orange-500/20 dark:border-orange-500/30 bg-orange-500/5 dark:bg-orange-500/10">
        <h3 className="font-semibold text-xl mb-3">Important Notes</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• 20-week internships = 2 credits (branch-specific IC) + 6/9 credits (DP-396P/399P)</li>
          <li>• Get FA consent before applying, especially for general/non-core companies</li>
          <li>• Some FAs require min 105 credits by end of 5th semester for 6th semester onsite internship</li>
          <li>• Projects under IIT Mandi faculty don&apos;t count as internships</li>
          <li>• Grading based on company feedback (Pass/Fail scheme)</li>
          <li>• Internship drop allowed before mid-semester with proper evaluation</li>
        </ul>
      </div>
    </div>
  );
}
