/**
 * Parse fractional inch input like "23 1/2", "23.5", "3/4", "12" into a decimal number.
 */
export function parseFraction(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;

  // Pure decimal: "23.5"
  if (/^\d+\.?\d*$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Pure fraction: "3/4"
  const fractionMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1]);
    const den = parseInt(fractionMatch[2]);
    return den !== 0 ? num / den : 0;
  }

  // Mixed: "23 1/2" or "23-1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s*[\s-]\s*(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const den = parseInt(mixedMatch[3]);
    return den !== 0 ? whole + num / den : whole;
  }

  // Fallback
  const n = parseFloat(trimmed);
  return isNaN(n) ? 0 : n;
}

/**
 * Convert a decimal number to a fractional string for display.
 * Uses common woodworking fractions (1/16 precision).
 */
export function toFraction(value: number): string {
  if (value === 0) return '0';

  const whole = Math.floor(value);
  let remainder = value - whole;

  if (remainder < 0.001) {
    return String(whole);
  }

  // Find closest 1/16
  const sixteenths = Math.round(remainder * 16);
  if (sixteenths === 0) return String(whole);
  if (sixteenths === 16) return String(whole + 1);

  // Simplify fraction
  let num = sixteenths;
  let den = 16;
  while (num % 2 === 0 && den % 2 === 0) {
    num /= 2;
    den /= 2;
  }

  if (whole === 0) return `${num}/${den}`;
  return `${whole} ${num}/${den}`;
}
