import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a datetime string from the backend as UTC.
 * Backend returns naive datetime (no timezone suffix) from PostgreSQL func.now() which is UTC.
 * Without the 'Z' suffix, `new Date()` interprets it as local time → off by timezone offset.
 */
export function parseUTC(dateStr: string): Date {
  if (!dateStr) return new Date();
  // Already has timezone info
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  // Append 'Z' to treat as UTC
  return new Date(dateStr + 'Z');
}
