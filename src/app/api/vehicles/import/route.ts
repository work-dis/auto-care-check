import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiErrorResponse, ApiError } from '@/server/shared/apiError';
import { fuelEntrySchema, tireSetSchema, vehicleDocumentSchema, vehicleSchema } from '@/lib/validation';
import { encryptSensitiveValue } from '@/lib/sensitiveData';

const importSchema = z.object({
  version: z.literal(1),
  vehicle: z.object({
    displayName: z.string(),
    make: z.string(),
    model: z.string(),
    year: z.number(),
    currentMileage: z.number(),
    mileageUnit: z.enum(['km', 'mi']),
    plateNumberEncryptedOrMasked: z.string().nullable().optional(),
    vinEncryptedOrMasked: z.string().nullable().optional(),
    fuelType: z.string().nullable().optional(),
    transmission: z.string().nullable().optional(),
    engineDescription: z.string().nullable().optional(),
    photoUrl: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    documents: z.array(z.unknown()).default([]),
    tireSets: z.array(z.unknown()).default([]),
    fuelEntries: z.array(z.unknown()).default([]),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const payload = importSchema.safeParse(await request.json());
    if (!payload.success) {
      throw new ApiError(400, 'INVALID_BACKUP', 'Файл не является резервной копией AutoPulse');
    }
    const source = payload.data.vehicle;
    const vehicleData = vehicleSchema.parse({
      displayName: `${source.displayName} (импорт)`,
      make: source.make,
      model: source.model,
      year: source.year,
      currentMileage: source.currentMileage,
      mileageUnit: source.mileageUnit,
      plateNumberEncryptedOrMasked: source.plateNumberEncryptedOrMasked,
      vinEncryptedOrMasked: source.vinEncryptedOrMasked,
      fuelType: source.fuelType,
      transmission: source.transmission,
      engineDescription: source.engineDescription,
      photoUrl: source.photoUrl,
      notes: source.notes,
    });
    const documents = source.documents
      .map((item) => vehicleDocumentSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data);
    const tireSets = source.tireSets
      .map((item) => tireSetSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data);
    const fuelEntries = source.fuelEntries
      .map((item) => fuelEntrySchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data);

    const imported = await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          userId,
          ...vehicleData,
          plateNumberEncryptedOrMasked: encryptSensitiveValue(
            vehicleData.plateNumberEncryptedOrMasked,
          ),
          vinEncryptedOrMasked: encryptSensitiveValue(vehicleData.vinEncryptedOrMasked),
        },
      });
      if (documents.length) {
        await tx.vehicleDocument.createMany({
          data: documents.map((document) => ({ vehicleId: vehicle.id, ...document })),
        });
      }
      if (tireSets.length) {
        await tx.tireSet.createMany({
          data: tireSets.map((tire) => ({ vehicleId: vehicle.id, ...tire })),
        });
      }
      if (fuelEntries.length) {
        await tx.fuelEntry.createMany({
          data: fuelEntries.map((entry) => ({ vehicleId: vehicle.id, ...entry })),
        });
      }
      return vehicle;
    });
    return NextResponse.json({ vehicle: imported }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Не удалось импортировать резервную копию');
  }
}
