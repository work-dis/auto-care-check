import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { encryptSensitiveValue } from '../src/lib/sensitiveData';

async function main() {
  if (!process.env.DATA_ENCRYPTION_KEY) {
    throw new Error('Set DATA_ENCRYPTION_KEY before encrypting existing data');
  }
  const vehicles = await prisma.vehicle.findMany({
    select: {
      id: true,
      plateNumberEncryptedOrMasked: true,
      vinEncryptedOrMasked: true,
    },
  });
  let updated = 0;
  for (const vehicle of vehicles) {
    const plate = encryptSensitiveValue(vehicle.plateNumberEncryptedOrMasked);
    const vin = encryptSensitiveValue(vehicle.vinEncryptedOrMasked);
    if (
      plate !== vehicle.plateNumberEncryptedOrMasked ||
      vin !== vehicle.vinEncryptedOrMasked
    ) {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          plateNumberEncryptedOrMasked: plate,
          vinEncryptedOrMasked: vin,
        },
      });
      updated += 1;
    }
  }
  console.log(`Encrypted sensitive fields for ${updated} vehicle(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
