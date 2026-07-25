import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

function extractReceiptFields(text: string) {
  const normalized = text.replaceAll(',', '.');
  const amountMatch = normalized.match(
    /(?:итого|total|сумма|к оплате)\D{0,20}(\d+(?:\.\d{1,2})?)/i,
  );
  const litersMatch = normalized.match(
    /(?:литр(?:ов|а)?|л\b|liters?)\D{0,15}(\d+(?:\.\d{1,3})?)/i,
  );
  const dateMatch = normalized.match(
    /\b(\d{2})[./-](\d{2})[./-](\d{2,4})\b/,
  );
  const currencyMatch = normalized.match(/\b(USD|BYN|RUB|EUR)\b/i);
  let filledAt: string | null = null;
  if (dateMatch) {
    const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
    filledAt = `${year}-${dateMatch[2]}-${dateMatch[1]}`;
  }
  return {
    totalCost: amountMatch ? Number(amountMatch[1]) : null,
    liters: litersMatch ? Number(litersMatch[1]) : null,
    filledAt,
    currency: currencyMatch?.[1]?.toUpperCase() || null,
  };
}

export async function POST(request: NextRequest) {
  await requireUser();
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: 'OCR_NOT_CONFIGURED', message: 'OCR-провайдер не настроен' } },
      { status: 503 },
    );
  }
  const { imageUrl } = await request.json();
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_URL', message: 'Некорректная ссылка на чек' } },
      { status: 400 },
    );
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('cloudinary.com')) {
    return NextResponse.json(
      { error: { code: 'INVALID_URL', message: 'Распознаются только загруженные изображения' } },
      { status: 400 },
    );
  }

  const form = new URLSearchParams({
    url: url.toString(),
    language: 'rus',
    isOverlayRequired: 'false',
    detectOrientation: 'true',
    scale: 'true',
    OCREngine: '2',
  });
  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    return NextResponse.json(
      { error: { code: 'OCR_FAILED', message: 'Сервис распознавания временно недоступен' } },
      { status: 502 },
    );
  }
  const result = await response.json() as {
    ParsedResults?: Array<{ ParsedText?: string }>;
    IsErroredOnProcessing?: boolean;
  };
  const text = result.ParsedResults?.map((item) => item.ParsedText || '').join('\n').trim();
  if (!text || result.IsErroredOnProcessing) {
    return NextResponse.json(
      { error: { code: 'OCR_EMPTY', message: 'Не удалось распознать текст чека' } },
      { status: 422 },
    );
  }
  return NextResponse.json({ text, fields: extractReceiptFields(text) });
}
