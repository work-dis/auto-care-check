CREATE TABLE "VehicleDocument" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "number" TEXT,
    "validFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TireSet" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "size" TEXT,
    "status" TEXT NOT NULL DEFAULT 'storage',
    "storageLocation" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3),
    "installedMileage" INTEGER,
    "totalDistance" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TireSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FuelEntry" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "filledAt" TIMESTAMP(3) NOT NULL,
    "mileage" INTEGER NOT NULL,
    "liters" DECIMAL(10,3) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "station" TEXT,
    "fullTank" BOOLEAN NOT NULL DEFAULT true,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FuelEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleMember" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleDocument_vehicleId_expiresAt_idx" ON "VehicleDocument"("vehicleId", "expiresAt");
CREATE INDEX "TireSet_vehicleId_status_idx" ON "TireSet"("vehicleId", "status");
CREATE INDEX "FuelEntry_vehicleId_filledAt_idx" ON "FuelEntry"("vehicleId", "filledAt");
CREATE INDEX "FuelEntry_vehicleId_mileage_idx" ON "FuelEntry"("vehicleId", "mileage");
CREATE UNIQUE INDEX "VehicleMember_vehicleId_userId_key" ON "VehicleMember"("vehicleId", "userId");
CREATE INDEX "VehicleMember_userId_idx" ON "VehicleMember"("userId");

ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireSet" ADD CONSTRAINT "TireSet_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelEntry" ADD CONSTRAINT "FuelEntry_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleMember" ADD CONSTRAINT "VehicleMember_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleMember" ADD CONSTRAINT "VehicleMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
