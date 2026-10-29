export const receivedCurrencies = [
  'KRW',
  'USD',
  'EUR',
  'JPY',
  'CNY',
  'GBP',
  'CAD',
  'AUD',
  'NZD',
  'SGD',
  'HKD',
  'TWD',
  'VND',
  'THB',
  'INR',
  'PHP',
  'BRL',
  'MXN',
  'CHF',
] as const;
export function receivedMoney(
  amount: number | string,
  currency: string,
  locale: string,
) {
  const [whole, fraction = ''] = String(amount).split('.');
  const cents = fraction.slice(0, 2).padEnd(2, '0');
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: cents === '00' ? 0 : 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(BigInt(whole))
    .map((part) => (part.type === 'fraction' ? cents : part.value))
    .join('');
}
