/**
 * Currency decimal map.
 * Currencies where the smallest unit is different from the default 2 decimals.
 */
const currencyDecimalMap: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  AUD: 2,
  CAD: 2,
  CHF: 2,
  CNY: 2,
  HKD: 2,
  NZD: 2,
  SEK: 2,
  KRW: 0,
  SGD: 2,
  NOK: 2,
  MXN: 2,
  INR: 2,
  THB: 2,
  DKK: 2,
  PLN: 2,
  TWD: 2,
  MYR: 2,
  PHP: 2,
  CZK: 2,
  IDR: 0,
  BRL: 2,
  ILS: 2,
  COP: 2,
  VND: 0,
  HUF: 2,
  RON: 2,
  TRY: 2,
  ZAR: 2,
}

export function getDecimalDigits(currency_code: string): number {
  return currencyDecimalMap[currency_code.toUpperCase()] ?? 2
}

/**
 * Convert from Medusa amount (smallest unit, e.g. 1099 for $10.99)
 * to PayPal decimal string (e.g. "10.99")
 */
export function toPayPalAmount(
  amount: number,
  currency_code: string
): string {
  const decimals = getDecimalDigits(currency_code)
  return (amount / Math.pow(10, decimals)).toFixed(decimals)
}

/**
 * Convert from PayPal decimal string (e.g. "10.99")
 * to Medusa amount (smallest unit, e.g. 1099)
 */
export function fromPayPalAmount(
  amount: string,
  currency_code: string
): number {
  const decimals = getDecimalDigits(currency_code)
  return Math.round(parseFloat(amount) * Math.pow(10, decimals))
}
