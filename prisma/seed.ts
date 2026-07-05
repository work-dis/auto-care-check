import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting AutoPulse seed...');

  const existing = await prisma.user.findUnique({ where: { username: 'demo' } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('demo123', 10);
    await prisma.user.create({
      data: {
        username: 'demo',
        name: 'Иван Демидов',
        passwordHash,
        timezone: 'Europe/Moscow',
        locale: 'ru',
        defaultReminderTime: '09:00',
      },
    });
    console.log('Demo user created: demo / demo123');
  } else {
    console.log('Demo user already exists, skipping.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
