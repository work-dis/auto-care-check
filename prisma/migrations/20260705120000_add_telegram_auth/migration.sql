-- Add Telegram authentication fields to User model
ALTER TABLE "User" ADD COLUMN "telegramId" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramAvatarUrl" TEXT;
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
