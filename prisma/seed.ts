import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding AutoPulse database...');

  const seededUserEmail = 'owner@autopulse.local';
  const seededPassword = 'autopulse123';
  const legacyDemoEmail = 'demo@autopulse.ru';

  // 1. Recreate the seeded owner account with a clean graph and remove the legacy demo user.
  await prisma.user.deleteMany({
    where: { email: legacyDemoEmail },
  });

  await prisma.user.deleteMany({
    where: { email: seededUserEmail },
  });

  const passwordHash = await bcrypt.hash(seededPassword, 10);
  const user = await prisma.user.create({
    data: {
      email: seededUserEmail,
      name: 'Владелец AutoPulse',
      passwordHash,
      timezone: 'Europe/Moscow',
      locale: 'ru',
      defaultReminderTime: '09:00',
    },
  });
  console.log(`Seed user created: ${user.email}`);
  console.log(`  Login: ${seededUserEmail} / ${seededPassword}`);

  // 2. Create Demo Vehicle
  const vehicle = await prisma.vehicle.create({
    data: {
      userId: user.id,
      displayName: 'Toyota Camry 2020',
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      currentMileage: 95400,
      mileageUnit: 'km',
      plateNumberEncryptedOrMasked: 'А123БВ777',
      vinEncryptedOrMasked: 'XW7AA1234567890',
      fuelType: 'Бензин',
      transmission: 'Автомат',
      engineDescription: '2.5л, 181 л.с.',
      isPrimary: true,
    },
  });
  console.log(`Demo Vehicle created: ${vehicle.displayName}`);

  // 3. Create Odometer Readings
  const tenMonthsAgo = new Date();
  tenMonthsAgo.setMonth(tenMonthsAgo.getMonth() - 10);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const today = new Date();

  await prisma.odometerReading.createMany({
    data: [
      {
        vehicleId: vehicle.id,
        mileage: 85000,
        recordedAt: tenMonthsAgo,
        source: 'service_record',
        comment: 'Покупка автомобиля и первое ТО',
      },
      {
        vehicleId: vehicle.id,
        mileage: 90000,
        recordedAt: sixMonthsAgo,
        source: 'service_record',
        comment: 'Плановая замена масла',
      },
      {
        vehicleId: vehicle.id,
        mileage: 95400,
        recordedAt: today,
        source: 'manual',
        comment: 'Текущий пробег (сеяный)',
      },
    ],
  });
  console.log('Odometer readings added');

  // 4. Create Maintenance Categories
  const categories = [
    { name: 'Двигатель', iconKey: 'engine', sortOrder: 1 },
    { name: 'Трансмиссия', iconKey: 'transmission', sortOrder: 2 },
    { name: 'Тормоза', iconKey: 'brakes', sortOrder: 3 },
    { name: 'Подвеска', iconKey: 'suspension', sortOrder: 4 },
    { name: 'Электрика', iconKey: 'electrical', sortOrder: 5 },
    { name: 'Документы', iconKey: 'file-text', sortOrder: 6 },
  ];

  const dbCategories = [];
  for (const cat of categories) {
    const createdCat = await prisma.maintenanceCategory.create({
      data: {
        vehicleId: vehicle.id,
        name: cat.name,
        iconKey: cat.iconKey,
        sortOrder: cat.sortOrder,
        isSystem: true,
      },
    });
    dbCategories.push(createdCat);
  }
  console.log('Maintenance categories created');

  const engineCat = dbCategories.find(c => c.name === 'Двигатель')!;
  const brakesCat = dbCategories.find(c => c.name === 'Тормоза')!;
  const docsCat = dbCategories.find(c => c.name === 'Документы')!;
  const suspensionCat = dbCategories.find(c => c.name === 'Подвеска')!;

  // 5. Create Maintenance Plans
  const plans = [
    {
      vehicleId: vehicle.id,
      categoryId: engineCat.id,
      title: 'Замена моторного масла и фильтра',
      description: 'Регулярная замена масла для поддержания здоровья двигателя',
      kind: 'scheduled_service',
      priority: 'high',
      scheduleMode: 'whichever_comes_first',
      intervalDays: 365,
      intervalMileage: 10000,
      lastCompletedAt: sixMonthsAgo,
      lastCompletedMileage: 90000,
      soonDaysThreshold: 30,
      soonMileageThreshold: 1000,
      watchDaysThreshold: 90,
      watchMileageThreshold: 3000,
    },
    {
      vehicleId: vehicle.id,
      categoryId: engineCat.id,
      title: 'Замена салонного и воздушного фильтров',
      description: 'Обеспечивает чистый воздух в салоне и правильное дыхание двигателя',
      kind: 'scheduled_service',
      priority: 'normal',
      scheduleMode: 'whichever_comes_first',
      intervalDays: 365,
      intervalMileage: 15000,
      lastCompletedAt: sixMonthsAgo,
      lastCompletedMileage: 90000,
      soonDaysThreshold: 30,
      soonMileageThreshold: 1000,
      watchDaysThreshold: 90,
      watchMileageThreshold: 3000,
    },
    {
      vehicleId: vehicle.id,
      categoryId: brakesCat.id,
      title: 'Проверка тормозов и замена колодок',
      description: 'Безопасность прежде всего. Проверка износа колодок и дисков',
      kind: 'inspection',
      priority: 'high',
      scheduleMode: 'mileage_only',
      intervalMileage: 20000,
      lastCompletedAt: tenMonthsAgo,
      lastCompletedMileage: 85000,
      soonDaysThreshold: 30,
      soonMileageThreshold: 1000,
      watchDaysThreshold: 90,
      watchMileageThreshold: 3000,
    },
    {
      vehicleId: vehicle.id,
      categoryId: docsCat.id,
      title: 'Продление ОСАГО',
      description: 'Ежегодное обязательное страхование гражданской ответственности',
      kind: 'document',
      priority: 'critical',
      scheduleMode: 'date_only',
      intervalDays: 365,
      lastCompletedAt: tenMonthsAgo, // Almost expired
      soonDaysThreshold: 30,
      watchDaysThreshold: 90,
    },
    {
      vehicleId: vehicle.id,
      categoryId: suspensionCat.id,
      title: 'Диагностика ходовой части',
      description: 'Подозрение на стук в передней подвеске с правой стороны',
      kind: 'observation',
      priority: 'normal',
      scheduleMode: 'manual',
      manualStatus: 'auto',
      manualDueAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // in 15 days
    }
  ];

  const dbPlans = [];
  for (const plan of plans) {
    const createdPlan = await prisma.maintenancePlan.create({
      data: plan,
    });
    dbPlans.push(createdPlan);
  }
  console.log('Maintenance plans created');

  // 6. Create Service Records (Completed services history)
  // Record 1: Buying and First Service (10 months ago)
  const record1 = await prisma.serviceRecord.create({
    data: {
      vehicleId: vehicle.id,
      performedAt: tenMonthsAgo,
      mileage: 85000,
      serviceName: 'Официальный дилер Toyota',
      serviceContact: '+7 (495) 123-45-67',
      laborCost: 5000.00,
      partsCost: 8000.00,
      totalCost: 13000.00,
      currency: 'RUB',
      notes: 'Комплексное ТО-1. Замена масла, фильтров, диагностика тормозов.',
      state: 'confirmed',
    },
  });

  // Record 2: Oil Change (6 months ago)
  const record2 = await prisma.serviceRecord.create({
    data: {
      vehicleId: vehicle.id,
      performedAt: sixMonthsAgo,
      mileage: 90000,
      serviceName: 'Автосервис "Красная Звезда"',
      serviceContact: '+7 (495) 765-43-21',
      laborCost: 1500.00,
      partsCost: 4500.00,
      totalCost: 6000.00,
      currency: 'RUB',
      notes: 'Замена масла в ДВС Liqui Moly 5W-30, замена масляного, салонного и воздушного фильтров.',
      state: 'confirmed',
    },
  });

  // Link Service Records to Plans as History Snapshots
  const oilPlan = dbPlans.find(p => p.title.includes('масла'))!;
  const filterPlan = dbPlans.find(p => p.title.includes('салонного'))!;
  const brakesPlan = dbPlans.find(p => p.title.includes('тормозов'))!;

  await prisma.serviceRecordPlanItem.createMany({
    data: [
      {
        serviceRecordId: record1.id,
        maintenancePlanId: brakesPlan.id,
        titleSnapshot: brakesPlan.title,
        categorySnapshot: brakesCat.name,
        actionType: 'inspected',
        costSnapshot: 3000.00,
      },
      {
        serviceRecordId: record2.id,
        maintenancePlanId: oilPlan.id,
        titleSnapshot: oilPlan.title,
        categorySnapshot: engineCat.name,
        actionType: 'completed',
        costSnapshot: 4000.00,
      },
      {
        serviceRecordId: record2.id,
        maintenancePlanId: filterPlan.id,
        titleSnapshot: filterPlan.title,
        categorySnapshot: engineCat.name,
        actionType: 'completed',
        costSnapshot: 2000.00,
      },
    ],
  });

  await prisma.servicePart.createMany({
    data: [
      {
        serviceRecordId: record2.id,
        nameSnapshot: 'Моторное масло Liqui Moly Special Tec AA 5W-30 4л',
        article: '7516',
        quantity: 1.0,
        unit: 'pcs',
        unitPrice: 3500.00,
        totalPrice: 3500.00,
      },
      {
        serviceRecordId: record2.id,
        nameSnapshot: 'Фильтр масляный Toyota',
        article: '04152-YZZA1',
        quantity: 1.0,
        unit: 'pcs',
        unitPrice: 1000.00,
        totalPrice: 1000.00,
      },
    ],
  });

  console.log('Service history links and parts seeded successfully.');
  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
