import { GraduationCap } from "lucide-react";

export default function MinorsSection() {
  const minors = [
    { name: "Computer Science Engineering", courses: "9+ credits", cgpa: "7.0" },
    { name: "Intelligent Systems", courses: "9+ credits", cgpa: "7.0" },
    { name: "Management", courses: "12+ credits", cgpa: "7.0" },
    { name: "Power Engineering", courses: "9+ credits", cgpa: "7.0" },
    { name: "Thermo-Fluid Systems", courses: "9+ credits", cgpa: "7.0" },
    { name: "Electronics Engineering", courses: "9+ credits", cgpa: "7.0" },
    { name: "Communication Engineering", courses: "9+ credits", cgpa: "7.0" },
    { name: "Mechanical Design", courses: "9+ credits", cgpa: "7.0" },
    { name: "Measurement and Instrumentation", courses: "9+ credits", cgpa: "7.0" },
    { name: "Device/Structural Materials", courses: "9+ credits", cgpa: "7.0" },
    { name: "Control Engineering", courses: "9+ credits", cgpa: "7.0" },
    { name: "Applied Physics", courses: "12+ credits", cgpa: "7.0" },
    { name: "Robotics", courses: "12+ credits", cgpa: "7.0" },
    { name: "German Language", courses: "9+ credits", cgpa: "7.0" },
    { name: "Quantum Technologies", courses: "12+ credits", cgpa: "7.0" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 p-6 rounded-xl border border-purple-500/20 dark:border-purple-500/30 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <GraduationCap className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold text-2xl">Minor Degrees</h3>
        </div>
        <p className="text-muted-foreground">
          Gain expertise in an area outside your major discipline. 15 different minor programs available.
        </p>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">General Requirements</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">9-12</p>
            <p className="text-sm text-muted-foreground mt-1">Credits Required</p>
          </div>
          <div className="p-4 rounded-lg bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/20 dark:border-purple-500/30 text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">7.0+</p>
            <p className="text-sm text-muted-foreground mt-1">Minimum CGPA</p>
          </div>
          <div className="p-4 rounded-lg bg-pink-500/10 dark:bg-pink-500/15 border border-pink-500/20 dark:border-pink-500/30 text-center">
            <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">&ne;</p>
            <p className="text-sm text-muted-foreground mt-1">Different from Major</p>
          </div>
        </div>
        <div className="mt-4 p-4 rounded-lg bg-accent/10 dark:bg-accent/15 border border-border/60 border-l-4 border-l-purple-500/60 dark:border-l-purple-500/50">
          <p className="text-sm text-muted-foreground">
            All courses count towards Free Electives basket<br />
            Courses must be non Pass/Fail and non Audit<br />
            One course can contribute to only one Minor<br />
            Specialist basket of at least 3 courses for each Minor
          </p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Available Minor Programs</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {minors.map((minor, idx) => (
            <div
              key={idx}
              className="p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-pink-500/5 dark:from-purple-500/10 dark:to-pink-500/10 border border-border/60"
            >
              <p className="font-semibold">{minor.name}</p>
              <div className="mt-2 flex flex-col sm:flex-row sm:justify-between gap-1 text-xs text-muted-foreground">
                <span>{minor.courses}</span>
                <span>CGPA: {minor.cgpa}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-lg mb-4 text-blue-600 dark:text-blue-400">Minor in Management</h3>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-sm mb-2">Prerequisites:</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• IC 252: Data Science II</li>
                <li>• One Communicative Competence course</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">Core (6 credits):</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• HS 202: Principles of Economics</li>
                <li>• HS 304: Organizational Management</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">Electives (2 courses):</p>
              <p className="text-xs text-muted-foreground">
                Choose from Financial Accounting, Organisational Behaviour, Consumer Behaviour, Financial Management, Entrepreneurship, and more
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-lg mb-4 text-purple-600 dark:text-purple-400">Minor in Robotics</h3>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-sm mb-2">Compulsory (2 courses):</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• AR 501/ME 452: Robot Kinematics, Dynamics, and Control</li>
                <li>• AR 503: Mechatronics</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">Electives (2 out of 14):</p>
              <p className="text-xs text-muted-foreground">
                Advanced Design, Robot Programming, Principles of Robot Autonomy, Cognitive Robotics, Probabilistic Robotics, Deep Learning for Robotics, Autonomous Mobile Robots, and more
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-orange-500/20 dark:border-orange-500/30 bg-orange-500/5 dark:bg-orange-500/10">
        <h3 className="font-semibold text-lg mb-3">Special: Quantum Technologies</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Can be taken as either Minor (12+ credits) or Specialization (18+ credits)
        </p>
        <div className="space-y-2 text-sm">
          <p><strong>Mandatory Foundation (1 of 2):</strong> QT 301 or QT 302/PH 513/EP 301</p>
          <p><strong>Mandatory Lab (1 of 2):</strong> QT 303P or QT 304P/QT 501P</p>
          <p><strong>Mandatory Advanced (1 of 4):</strong> Quantum Computation, Communication, Sensing, or Materials</p>
          <p><strong>Optional:</strong> Engineering Foundation, Solid State Physics, Quantum Optics, Post Quantum Security</p>
        </div>
      </div>
    </div>
  );
}
