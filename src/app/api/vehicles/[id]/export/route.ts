import { NextRequest, NextResponse } from 'next/server';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiErrorResponse } from '@/server/shared/apiError';
import { requireVehicleAccess } from '@/server/vehicles/access';
import { formatMoney } from '@/domain/money/currencies';
import { decryptVehicleFields } from '@/lib/sensitiveData';

const bundledFonts = pdfFonts as unknown as {
  vfs?: Record<string, string>;
} & Record<string, string>;
pdfMake.vfs = bundledFonts.vfs || bundledFonts;

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function pdfBuffer(definition: TDocumentDefinitions) {
  return new Promise<Buffer>((resolve) => {
    pdfMake.createPdf(definition).getBuffer((buffer) => resolve(Buffer.from(buffer)));
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getSessionUserId();
    const { id } = await params;
    await requireVehicleAccess(id, userId);
    const vehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id },
      include: {
        odometerReadings: { orderBy: { recordedAt: 'desc' } },
        maintenancePlans: { include: { category: true }, orderBy: { createdAt: 'desc' } },
        serviceRecords: { include: { planItems: true, parts: true }, orderBy: { performedAt: 'desc' } },
        observations: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { expiresAt: 'asc' } },
        tireSets: { orderBy: { createdAt: 'desc' } },
        fuelEntries: { orderBy: { filledAt: 'desc' } },
      },
    });
    const portableVehicle = decryptVehicleFields(vehicle);
    const format = request.nextUrl.searchParams.get('format') || 'json';
    const safeName = vehicle.displayName.replace(/[^\p{L}\p{N}_-]+/gu, '_');
    const encodedName = encodeURIComponent(safeName);

    if (format === 'csv') {
      const rows = [
        ['Раздел', 'Дата', 'Название', 'Пробег', 'Количество', 'Сумма', 'Валюта', 'Комментарий'],
        ...vehicle.serviceRecords.map((record) => [
          'ТО',
          record.performedAt.toISOString().slice(0, 10),
          record.serviceName,
          record.mileage,
          '',
          record.totalCost,
          record.currency,
          record.notes || '',
        ]),
        ...vehicle.fuelEntries.map((entry) => [
          'Заправка',
          entry.filledAt.toISOString().slice(0, 10),
          entry.station || 'Заправка',
          entry.mileage,
          entry.liters,
          entry.totalCost,
          entry.currency,
          entry.notes || '',
        ]),
      ];
      return new NextResponse(rows.map((row) => row.map(csvCell).join(',')).join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="autopulse.csv"; filename*=UTF-8''${encodedName}.csv`,
        },
      });
    }

    if (format === 'pdf') {
      const content: Content[] = [
        { text: 'AutoPulse - бортовой журнал', style: 'title' },
        { text: `${vehicle.displayName} - ${vehicle.make} ${vehicle.model}, ${vehicle.year}`, style: 'subtitle' },
        { text: `Текущий пробег: ${vehicle.currentMileage.toLocaleString('ru-RU')} ${vehicle.mileageUnit}`, margin: [0, 0, 0, 18] },
        { text: 'История обслуживания', style: 'section' },
        vehicle.serviceRecords.length
          ? {
              table: {
                headerRows: 1,
                widths: [65, '*', 65, 75],
                body: [
                  ['Дата', 'Работа', 'Пробег', 'Стоимость'],
                  ...vehicle.serviceRecords.map((record) => [
                    record.performedAt.toLocaleDateString('ru-RU'),
                    record.serviceName,
                    record.mileage.toLocaleString('ru-RU'),
                    formatMoney(Number(record.totalCost), record.currency),
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            }
          : { text: 'Записей пока нет.', color: '#666666' },
        { text: 'Заправки', style: 'section', pageBreak: vehicle.serviceRecords.length > 12 ? 'before' : undefined },
        vehicle.fuelEntries.length
          ? {
              table: {
                headerRows: 1,
                widths: [65, 70, 55, 65, '*'],
                body: [
                  ['Дата', 'Пробег', 'Литры', 'Стоимость', 'АЗС'],
                  ...vehicle.fuelEntries.map((entry) => [
                    entry.filledAt.toLocaleDateString('ru-RU'),
                    entry.mileage.toLocaleString('ru-RU'),
                    Number(entry.liters).toLocaleString('ru-RU'),
                    formatMoney(Number(entry.totalCost), entry.currency),
                    entry.station || '-',
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            }
          : { text: 'Заправок пока нет.', color: '#666666' },
        { text: 'Документы', style: 'section' },
        ...(vehicle.documents.length
          ? vehicle.documents.map((document) => ({
              text: `${document.title}${document.expiresAt ? ` - до ${document.expiresAt.toLocaleDateString('ru-RU')}` : ''}`,
              margin: [0, 2, 0, 2] as [number, number, number, number],
            }))
          : [{ text: 'Документы пока не добавлены.', color: '#666666' }]),
      ];
      const buffer = await pdfBuffer({
        content,
        defaultStyle: { font: 'Roboto', fontSize: 9, color: '#202124' },
        styles: {
          title: { fontSize: 22, bold: true, color: '#0f766e', margin: [0, 0, 0, 6] },
          subtitle: { fontSize: 12, bold: true, margin: [0, 0, 0, 4] },
          section: { fontSize: 14, bold: true, color: '#0f766e', margin: [0, 18, 0, 8] },
        },
        footer: (page, pages) => ({
          text: `${page} / ${pages}`,
          alignment: 'center',
          fontSize: 8,
          color: '#777777',
          margin: [0, 10, 0, 0],
        }),
        pageMargins: [36, 42, 36, 42],
      });
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="autopulse.pdf"; filename*=UTF-8''${encodedName}.pdf`,
        },
      });
    }

    return NextResponse.json(
      { version: 1, exportedAt: new Date().toISOString(), vehicle: portableVehicle },
      {
        headers: {
          'Content-Disposition': `attachment; filename="autopulse.json"; filename*=UTF-8''${encodedName}.json`,
        },
      },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Не удалось экспортировать журнал');
  }
}
