import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting AutoPulse seed cleanup...');

  // Remove any legacy seeded/demo users from older local setups.
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['demo@autopulse.ru', 'owner@autopulse.local'],
      },
    },
  });

  console.log('Legacy seeded accounts removed if they existed.');
  console.log('No default user is created. Register a real account through the app.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
