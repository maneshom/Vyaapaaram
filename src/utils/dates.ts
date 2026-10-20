import { ReportPeriodFilter } from '../types';

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPeriodFilter(type: 'today' | 'this_month' | 'last_30_days' | 'custom', customStart?: string, customEnd?: string): ReportPeriodFilter {
  const now = new Date();
  const todayStr = getTodayDateString();

  if (type === 'today') {
    return {
      type: 'today',
      startDate: todayStr,
      endDate: todayStr,
    };
  }

  if (type === 'this_month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-01`;
    return {
      type: 'this_month',
      startDate: startStr,
      endDate: todayStr,
    };
  }

  if (type === 'last_30_days') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 29);
    const startYear = thirtyDaysAgo.getFullYear();
    const startMonth = String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0');
    const startDay = String(thirtyDaysAgo.getDate()).padStart(2, '0');
    return {
      type: 'last_30_days',
      startDate: `${startYear}-${startMonth}-${startDay}`,
      endDate: todayStr,
    };
  }

  return {
    type: 'custom',
    startDate: customStart || todayStr,
    endDate: customEnd || todayStr,
  };
}

export function isDateInPeriod(dateString: string, filter: ReportPeriodFilter): boolean {
  if (!dateString) return false;
  // If dateString is full ISO, extract date part YYYY-MM-DD
  const dateOnly = dateString.substring(0, 10);
  return dateOnly >= filter.startDate && dateOnly <= filter.endDate;
}

