import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/lib/auth';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@autopulse.ru';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await hashPassword('demo123');
    user = await prisma.user.create({
      data: {
        email,
        name: 'Иван Демидов',
        passwordHash,
        timezone: 'Europe/Moscow',
        locale: 'ru',
        defaultReminderTime: '09:00',
      },
    });
    console.log('User created:', user.id);
  } else {
    console.log('User exists:', user.id);
  }

  // Find or create vehicle
  let vehicle = await prisma.vehicle.findFirst({ where: { userId: user.id } });
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        userId: user.id,
        displayName: 'Toyota Camry',
        make: 'Toyota',
        model: 'Camry',
        year: 2022,
        currentMileage: 45000,
        mileageUnit: 'km',
        fuelType: 'Бензин',
        transmission: 'Автомат',
        engineDescription: '2.5L I4',
        plateNumberEncryptedOrMasked: 'А123ВВ**777',
        vinEncryptedOrMasked: 'JTNB23HK**302****',
      },
    });
    console.log('Vehicle created:', vehicle.id);

    // Initial odometer
    await prisma.odometerReading.create({
      data: {
        vehicleId: vehicle.id,
        mileage: 45000,
        recordedAt: new Date(),
        source: 'manual',
        comment: 'Начальный пробег при создании карточки автомобиля',
      },
    });
  } else {
    console.log('Vehicle exists:', vehicle.id);
  }

  // Create system categories if none exist
  const catCount = await prisma.maintenanceCategory.count({ where: { isSystem: true } });
  if (catCount === 0) {
    const systemCategories = [
      { name: 'Двигатель и масла', iconKey: 'oil', sortOrder: 1 },
      { name: 'Трансмиссия', iconKey: 'gears', sortOrder: 2 },
      { name: 'Тормозная система', iconKey: 'brakes', sortOrder: 3 },
      { name: 'Ходовая часть', iconKey: 'suspension', sortOrder: 4 },
      { name: 'Электрика', iconKey: 'battery', sortOrder: 5 },
      { name: 'Шины и колёса', iconKey: 'tire', sortOrder: 6 },
      { name: 'Кузов и салон', iconKey: 'car', sortOrder: 7 },
      { name: 'Прочее', iconKey: 'wrench', sortOrder: 99 },
    ];
    for (const cat of systemCategories) {
      await prisma.maintenanceCategory.create({
        data: { ...cat, isSystem: true },
      });
    }
    console.log(`Created ${systemCategories.length} system categories`);
  } else {
    console.log(`Categories already exist: ${catCount}`);
  }

  // Get oil category
  const oilCat = await prisma.maintenanceCategory.findFirst({
    where: { isSystem: true, name: 'Двигатель и масла' },
  });

  const engineCat = await prisma.maintenanceCategory.findFirst({
    where: { isSystem: true, name: 'Двигатель и масла' },
  });

  const brakesCat = await prisma.maintenanceCategory.findFirst({
    where: { isSystem: true, name: 'Тормозная система' },
  });

  const electricCat = await prisma.maintenanceCategory.findFirst({
    where: { isSystem: true, name: 'Электрика' },
  });

  const transCat = await prisma.maintenanceCategory.findFirst({
    where: { isSystem: true, name: 'Трансмиссия' },
  });

  const coolantCat = await prisma.maintenanceCategory.findFirst({
    where: { isSystem: true, name: 'Прочее' },
  });

  // Create maintenance plans
  const planCount = await prisma.maintenancePlan.count({ where: { vehicleId: vehicle.id } });
  if (planCount === 0) {
    const plans = [
      {
        title: 'Замена масла и фильтра',
        kind: 'scheduled_service',
        priority: 'high',
        scheduleMode: 'mileage_only',
        intervalMileage: 10000,
        soonMileageThreshold: 1000,
        watchMileageThreshold: 3000,
        lastCompletedMileage: 40000,
        lastCompletedAt: new Date('2025-12-15'),
      },
      {
        title: 'Замена ремня ГРМ',
        kind: 'scheduled_service',
        priority: 'critical',
        scheduleMode: 'mileage_only',
        intervalMileage: 90000,
        soonMileageThreshold: 5000,
        watchMileageThreshold: 15000,
        lastCompletedMileage: 0,  // never changed on this car
      },
      {
        title: 'Замена свечей зажигания',
        kind: 'scheduled_service',
        priority: 'normal',
        scheduleMode: 'mileage_only',
        intervalMileage: 45000,
        soonMileageThreshold: 3000,
        watchMileageThreshold: 8000,
        lastCompletedMileage: 0,
      },
      {
        title: 'Замена тормозной жидкости',
        kind: 'scheduled_service',
        priority: 'high',
        scheduleMode: 'date_only',
        intervalDays: 730, // 2 years
        soonDaysThreshold: 30,
        watchDaysThreshold: 90,
        lastCompletedAt: new Date('2024-01-10'),
      },
      {
        title: 'Замена масла в АКПП',
        kind: 'scheduled_service',
        priority: 'normal',
        scheduleMode: 'mileage_only',
        intervalMileage: 60000,
        soonMileageThreshold: 5000,
        watchMileageThreshold: 15000,
        lastCompletedMileage: 40000,
        lastCompletedAt: new Date('2025-12-15'),
      },
      {
        title: 'Замена антифриза',
        kind: 'scheduled_service',
        priority: 'normal',
        scheduleMode: 'date_only',
        intervalDays: 1095, // 3 years
        soonDaysThreshold: 60,
        watchDaysThreshold: 180,
        lastCompletedAt: new Date('2023-06-01'),
      },
    ];

    for (const plan of plans) {
      let categoryId = engineCat!.id;
      if (plan.title.includes('тормоз')) categoryId = brakesCat!.id;
      if (plan.title.includes('масло в АКПП') || plan.title.includes('трансмисси')) categoryId = transCat!.id;
      if (plan.title.includes('антифриз') || plan.title.includes('охлажд')) categoryId = coolantCat!.id;
      if (plan.title.includes('свечи')) categoryId = electricCat!.id;

      await prisma.maintenancePlan.create({
        data: {
          vehicleId: vehicle.id,
          categoryId,
          title: plan.title,
          kind: plan.kind,
          priority: plan.priority,
          scheduleMode: plan.scheduleMode,
          intervalDays: plan.intervalDays ?? null,
          intervalMileage: plan.intervalMileage ?? null,
          soonDaysThreshold: plan.soonDaysThreshold ?? 30,
          soonMileageThreshold: plan.soonMileageThreshold ?? 1000,
          watchDaysThreshold: plan.watchDaysThreshold ?? 90,
          watchMileageThreshold: plan.watchMileageThreshold ?? 3000,
          lastCompletedMileage: plan.lastCompletedMileage ?? null,
          lastCompletedAt: plan.lastCompletedAt ?? null,
        },
      });
      console.log(`  ✓ Plan: ${plan.title}`);
    }
    console.log(`Created ${plans.length} maintenance plans`);
  } else {
    console.log(`Plans already exist: ${planCount}`);
  }

  // Add a service record
  const recordCount = await prisma.serviceRecord.count({ where: { vehicleId: vehicle.id } });
  if (recordCount === 0) {
    const oilPlan2 = await prisma.maintenancePlan.findFirst({
      where: { vehicleId: vehicle.id, title: 'Замена масла и фильтра' },
    });

    const record = await prisma.serviceRecord.create({
      data: {
        vehicleId: vehicle.id,
        performedAt: new Date('2025-12-15'),
        mileage: 40000,
        serviceName: 'Плановое ТО 40000 км',
        serviceContact: 'Официальный дилер Toyota',
        laborCost: 3500,
        partsCost: 8500,
        currency: 'RUB',
        notes: 'Замена масла, фильтра, диагностика',
        state: 'confirmed',
      },
    });

    if (oilPlan2) {
      await prisma.serviceRecordPlanItem.create({
        data: {
          serviceRecordId: record.id,
          maintenancePlanId: oilPlan2.id,
          titleSnapshot: oilPlan2.title,
          categorySnapshot: 'Двигатель и масла',
          actionType: 'completed',
          costSnapshot: 5000,
        },
      });

      await prisma.maintenancePlan.update({
        where: { id: oilPlan2.id },
        data: {
          lastCompletedAt: new Date('2025-12-15'),
          lastCompletedMileage: 40000,
        },
      });
    }

    console.log('Service record created');
  }

  await prisma.$disconnect();
  console.log('\n✅ Done! Demo data is ready.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
