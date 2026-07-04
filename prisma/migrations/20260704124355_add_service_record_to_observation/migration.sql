-- AlterTable
ALTER TABLE "Observation" ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "serviceRecordId" TEXT;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_serviceRecordId_fkey" FOREIGN KEY ("serviceRecordId") REFERENCES "ServiceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
