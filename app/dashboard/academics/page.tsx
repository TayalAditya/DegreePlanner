import AcademicsClient from "./AcademicsClient";

export default function AcademicsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Academic Information
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Complete guide to B.Tech & B.S. 2023 academic requirements
        </p>
      </div>

      <AcademicsClient />
    </div>
  );
}
