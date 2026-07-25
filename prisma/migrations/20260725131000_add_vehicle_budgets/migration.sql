CREATE TABLE "VehicleBudget" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "annualLimit" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleBudget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleBudget_vehicleId_currency_key"
ON "VehicleBudget"("vehicleId", "currency");

ALTER TABLE "VehicleBudget" ADD CONSTRAINT "VehicleBudget_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
