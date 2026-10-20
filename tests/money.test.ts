import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  paiseToRupees,
  formatMoney,
  paiseToInputString,
} from '../src/utils/money';

describe('Money Utilities (Paise Representation)', () => {
  it('converts rupee numbers to integer paise correctly', () => {
    expect(rupeesToPaise(10)).toBe(1000);
    expect(rupeesToPaise(10.5)).toBe(1050);
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise(0.05)).toBe(5);
    expect(rupeesToPaise(0)).toBe(0);
  });

  it('converts rupee strings with spaces, commas, or symbols', () => {
    expect(rupeesToPaise('₹1,500.50')).toBe(150050);
    expect(rupeesToPaise('Rs 250.75')).toBe(25075);
    expect(rupeesToPaise('100')).toBe(10000);
    expect(rupeesToPaise('')).toBe(0);
  });

  it('converts integer paise back to rupees', () => {
    expect(paiseToRupees(1000)).toBe(10);
    expect(paiseToRupees(1050)).toBe(10.5);
    expect(paiseToRupees(0)).toBe(0);
  });

  it('formats money using Indian numbering system with Rupee symbol ₹', () => {
    const formatted = formatMoney(12345678); // ₹1,23,456.78
    expect(formatted).toContain('₹');
    expect(formatted).toContain('1,23,456.78');
    expect(formatted).not.toContain('R ');
  });

  it('never uses "R" as a rupee abbreviation', () => {
    const symbolFmt = formatMoney(50000, { preference: 'symbol' });
    expect(symbolFmt).toContain('₹500.00');
    expect(symbolFmt.startsWith('R')).toBe(false);

    const textFmt = formatMoney(50000, { preference: 'text' });
    expect(textFmt).toContain('Rs 500.00');
    expect(textFmt.startsWith('R ')).toBe(false); // Must be 'Rs ', never 'R '
  });

  it('supports plain-text fallback with "Rs"', () => {
    const plain = formatMoney(7500, { plainText: true });
    expect(plain).toBe('Rs 75.00');
  });

  it('handles negative amounts cleanly', () => {
    const negSymbol = formatMoney(-1500, { preference: 'symbol' });
    expect(negSymbol).toBe('-₹15.00');

    const negText = formatMoney(-1500, { preference: 'text' });
    expect(negText).toBe('-Rs 15.00');
  });

  it('formats input values without symbols', () => {
    expect(paiseToInputString(12500)).toBe('125.00');
    expect(paiseToInputString(0)).toBe('');
    expect(paiseToInputString(undefined)).toBe('');
  });
});

