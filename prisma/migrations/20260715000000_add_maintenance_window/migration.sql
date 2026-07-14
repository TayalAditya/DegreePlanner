CREATE TABLE "MaintenanceWindow" (
    "id" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3),
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceWindow_pkey" PRIMARY KEY ("id")
);
