CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification"
ADD COLUMN "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "processingAt" TIMESTAMP(3),
ADD COLUMN "lastError" TEXT;

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX "Vehicle_userId_archivedAt_idx" ON "Vehicle"("userId", "archivedAt");
CREATE INDEX "OdometerReading_vehicleId_recordedAt_idx" ON "OdometerReading"("vehicleId", "recordedAt");
CREATE INDEX "MaintenanceCategory_vehicleId_archivedAt_idx" ON "MaintenanceCategory"("vehicleId", "archivedAt");
CREATE INDEX "MaintenancePlan_vehicleId_archivedAt_disabledAt_idx" ON "MaintenancePlan"("vehicleId", "archivedAt", "disabledAt");
CREATE INDEX "ServiceRecord_vehicleId_state_performedAt_idx" ON "ServiceRecord"("vehicleId", "state", "performedAt");
CREATE INDEX "Observation_vehicleId_state_idx" ON "Observation"("vehicleId", "state");
CREATE INDEX "ReminderRule_vehicleId_isEnabled_idx" ON "ReminderRule"("vehicleId", "isEnabled");
CREATE INDEX "ReminderRule_maintenancePlanId_idx" ON "ReminderRule"("maintenancePlanId");
CREATE INDEX "ReminderRule_observationId_idx" ON "ReminderRule"("observationId");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "Notification_status_scheduledFor_idx" ON "Notification"("status", "scheduledFor");
CREATE INDEX "Notification_reminderRuleId_status_idx" ON "Notification"("reminderRuleId", "status");
CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

ALTER TABLE "PushSubscription"
ADD CONSTRAINT "PushSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
