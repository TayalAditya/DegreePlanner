import { Award, CheckCircle } from "lucide-react";
import { MTP_TOTAL_CREDITS } from "@/lib/mtpConfig";

export default function HonoursSection() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 dark:from-yellow-500/20 dark:to-orange-500/20 p-6 rounded-xl border border-yellow-500/20 dark:border-yellow-500/30 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Award className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          <h3 className="font-semibold text-2xl">Honours Degree</h3>
        </div>
        <p className="text-muted-foreground">
          Earn B.Tech. (Honours) or B.S. (Honours) by meeting excellence criteria
        </p>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Basic Requirements</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-hover/70 border border-border/60">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <p className="font-semibold">Application Timing</p>
              <p className="text-sm text-muted-foreground">4th or 5th semester (no F grade till then)</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-hover/70 border border-border/60">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <p className="font-semibold">MTP Requirement</p>
              <p className="text-sm text-muted-foreground">{MTP_TOTAL_CREDITS} credits of MTP (branch-498P + branch-499P) in parent discipline</p>
              <p className="text-xs text-muted-foreground mt-1">* Waived for IDD students (required to do PGP)</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-hover/70 border border-border/60">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <p className="font-semibold">No F Grades</p>
              <p className="text-sm text-muted-foreground">Throughout the entire program</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card p-6 rounded-xl border border-blue-500/20 dark:border-blue-500/30">
          <h3 className="font-semibold text-xl mb-4 text-blue-600 dark:text-blue-400">Mode A</h3>
          <div className="space-y-3">
            <div className="text-center p-4 rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">8.5+</p>
              <p className="text-sm text-muted-foreground mt-1">CGPA Required</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Achieve a CGPA of 8.5 or more out of total credits completed
            </p>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border border-purple-500/20 dark:border-purple-500/30">
          <h3 className="font-semibold text-xl mb-4 text-purple-600 dark:text-purple-400">Mode B</h3>
          <div className="space-y-3">
            <div className="text-center p-4 rounded-lg bg-purple-500/10 dark:bg-purple-500/15">
              <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">8.0+</p>
              <p className="text-sm text-muted-foreground mt-1">CGPA Required</p>
            </div>
            <p className="text-sm font-semibold">Plus one of:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Q1 SCI Journal publication (accepted/published)</li>
              <li>• Patent granted in relevant discipline</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Publication/Patent Guidelines</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• Article must be submitted and accepted during IIT Mandi registration</p>
          <p>• Must be declared before last date of 8th semester grade submission</p>
          <p>• Publication/patent must have IIT Mandi affiliation</p>
          <p>• Student must be first author (or main inventor for patents)</p>
          <p>• Same work cannot be counted by multiple students</p>
          <p>• Journal must be Q1 at time of submission/acceptance</p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-green-500/20 dark:border-green-500/30 bg-green-500/5 dark:bg-green-500/10">
        <h3 className="font-semibold text-xl mb-4">Honours Degree Awards</h3>
        <div className="space-y-2">
          <p className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span><strong>B.Tech/B.S. students:</strong> B.Tech. (Honours) / B.S. (Honours) in {"<"}discipline{">"}</span>
          </p>
          <p className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span><strong>IDD students:</strong> B.Tech. (Honours) and M.Tech. / B.S. (Honours) and M.S.</span>
          </p>
          <p className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span><strong>Double Major:</strong> B.Tech. (Honours) with Second Major in {"<"}discipline{">"}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
