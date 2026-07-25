export const SUPPORTED_CURRENCIES = ['USD', 'BYN', 'RUB', 'EUR'] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  USD: 'USD — доллар США',
  BYN: 'BYN — белорусский рубль',
  RUB: 'RUB — российский рубль',
  EUR: 'EUR — евро',
};

export function formatMoney(
  value: number,
  currency: SupportedCurrency | string,
  locale = 'ru-RU',
) {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString(locale)} ${currency}`;
  }
}
