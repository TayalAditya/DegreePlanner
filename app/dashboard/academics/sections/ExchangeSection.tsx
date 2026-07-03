export default function ExchangeSection() {
  const universities = [
    { name: "TU Munich", country: "Germany" },
    { name: "TU Dresden", country: "Germany" },
    { name: "TU Darmstadt", country: "Germany" },
    { name: "TU Braunschweig", country: "Germany" },
    { name: "RWTH Aachen", country: "Germany" },
    { name: "Karlsruhe Institute of Technology", country: "Germany" },
    { name: "Leibniz University, Hannover", country: "Germany" },
    { name: "Université de Pau et des Pays de l’Adour", country: "France" },
    { name: "University of Agder", country: "Norway" },
    { name: "Kyushu University", country: "Japan" },
    { name: "National University Corporation", country: "Japan" },
    { name: "Chung Yuan Christian University", country: "Taiwan" },
    { name: "Missouri University of Science and Technology", country: "USA" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Semester Exchange Program</h3>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30">
              <h4 className="font-semibold mb-2">Eligibility</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• 5th - 7th semester students</li>
                <li>• Maximum 2 contiguous semesters</li>
                <li>• Selection based on CGPA</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/20 dark:border-purple-500/30">
              <h4 className="font-semibold mb-2">Financial</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• No fees to host institute</li>
                <li>• Student bears travel/stay/food costs</li>
                <li>• Scholarships may be available</li>
              </ul>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-accent/10 dark:bg-accent/15 border border-border/60 border-l-4 border-l-blue-500/60 dark:border-l-blue-500/50">
            <h4 className="font-semibold mb-2">Why Students Prefer Exchange</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Explore courses not offered at IIT Mandi</li>
              <li>• Learn about new cultures</li>
              <li>• Traveling & tourism opportunities</li>
              <li>• International exposure</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Partner Universities</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {universities.map((uni, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10 border border-border/60">
              <p className="font-semibold text-sm break-words">{uni.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{uni.country}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-lg mb-4">Grade Conversion (EU/TU9)</h3>
          <div className="space-y-2">
            {[
              { ects: "A", iit: "A" },
              { ects: "B", iit: "A-" },
              { ects: "C", iit: "B" },
              { ects: "D", iit: "B-" },
              { ects: "E", iit: "C" },
              { ects: "FX/F", iit: "F" },
            ].map((grade, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-3 rounded-lg bg-surface-hover/70 border border-border/60">
                <span className="font-mono text-blue-600 dark:text-blue-400">{grade.ects}</span>
                <span className="font-mono text-purple-600 dark:text-purple-400">{grade.iit}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-3">
              * 1.5 ECTS credits = 1 IIT Mandi credit
            </p>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-lg mb-4">Grade Conversion (Kyushu)</h3>
          <div className="space-y-2">
            {[
              { kyushu: "S (4)", iit: "A" },
              { kyushu: "A (3)", iit: "B" },
              { kyushu: "B (2)", iit: "C" },
              { kyushu: "C (1)", iit: "D" },
              { kyushu: "F (0)", iit: "F" },
            ].map((grade, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-3 rounded-lg bg-surface-hover/70 border border-border/60">
                <span className="font-mono text-blue-600 dark:text-blue-400">{grade.kyushu}</span>
                <span className="font-mono text-purple-600 dark:text-purple-400">{grade.iit}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-3">
              * 1 Kyushu credit = 1 IIT Mandi credit
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-blue-500/20 dark:border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10">
        <h3 className="font-semibold text-lg mb-3">Attendance Management</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Students can register for ongoing semester courses</li>
          <li>• Attendance counts from the day they report to institute</li>
          <li>• Video recordings/online classes/NPTEL courses may be provided</li>
          <li>• Mid-sem exams during makeup slots</li>
          <li>• Regular end-sem exam schedule</li>
          <li>• Instructors may impose 100% attendance (excluding medical)</li>
        </ul>
      </div>
    </div>
  );
}
