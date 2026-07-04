-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_maintenancePlanId_fkey" FOREIGN KEY ("maintenancePlanId") REFERENCES "MaintenancePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
