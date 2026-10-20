import { CurrencyPreference } from '../types';

/**
 * Converts a rupee amount (number or string) to integer paise.
 * Safely handles decimals to avoid JavaScript IEEE-754 floating point issues.
 */
export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    // Remove currency symbols, commas, spaces
    const cleaned = rupees.replace(/[₹\s,]|Rs\.?/gi, '').trim();
    if (!cleaned || isNaN(Number(cleaned))) {
      return 0;
    }
    const num = parseFloat(cleaned);
    return Math.round(num * 100);
  }

  if (isNaN(rupees) || !isFinite(rupees)) {
    return 0;
  }

  return Math.round(rupees * 100);
}

/**
 * Converts integer paise to rupees as a standard number.
 */
export function paiseToRupees(paise: number): number {
  if (!paise || isNaN(paise)) return 0;
  return paise / 100;
}

export interface FormatMoneyOptions {
  preference?: CurrencyPreference; // 'symbol' (₹) | 'text' (Rs)
  plainText?: boolean; // If true, forces 'Rs ' instead of ₹
  showSymbol?: boolean; // default true
  compact?: boolean;
}

/**
 * Formats integer paise into a standard Indian numbering formatted string (e.g. ₹1,23,456.78 or Rs 1,23,456.78).
 * NEVER uses 'R'. Always uses '₹' or 'Rs'.
 */
export function formatMoney(
  paise: number,
  options: FormatMoneyOptions = {}
): string {
  const { preference = 'symbol', plainText = false, showSymbol = true } = options;

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise || 0);
  const rupees = absPaise / 100;

  // Format using Indian English locale for lakh/crore comma grouping (e.g. 1,00,000.00)
  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);

  if (!showSymbol) {
    return `${isNegative ? '-' : ''}${formattedNumber}`;
  }

  const useSymbol = preference === 'symbol' && !plainText;
  const prefix = useSymbol ? '₹' : 'Rs ';

  return `${isNegative ? '-' : ''}${prefix}${formattedNumber}`;
}

/**
 * Simple helper to format input fields cleanly as rupees string without symbol.
 */
export function paiseToInputString(paise: number | undefined): string {
  if (paise === undefined || paise === null || isNaN(paise) || paise === 0) {
    return '';
  }
  return (paise / 100).toFixed(2);
}

