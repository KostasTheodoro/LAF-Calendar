// Common override options if auto-detect is wrong
export const TIMEZONE_OPTIONS = [
  { label: 'South Africa (SAST)', value: 'Africa/Johannesburg' },
  { label: 'UK (GMT/BST)', value: 'Europe/London' },
  { label: 'Central Europe (CET/CEST)', value: 'Europe/Berlin' },
  { label: 'Eastern Europe (EET/EEST)', value: 'Europe/Athens' },
  { label: 'Moscow (MSK)', value: 'Europe/Moscow' },
  { label: 'Dubai (GST)', value: 'Asia/Dubai' },
  { label: 'India (IST)', value: 'Asia/Kolkata' },
  { label: 'Singapore (SGT)', value: 'Asia/Singapore' },
  { label: 'Japan (JST)', value: 'Asia/Tokyo' },
  { label: 'Sydney (AEST/AEDT)', value: 'Australia/Sydney' },
  { label: 'New Zealand (NZST/NZDT)', value: 'Pacific/Auckland' },
  { label: 'US Eastern (EST/EDT)', value: 'America/New_York' },
  { label: 'US Central (CST/CDT)', value: 'America/Chicago' },
  { label: 'US Mountain (MST/MDT)', value: 'America/Denver' },
  { label: 'US Pacific (PST/PDT)', value: 'America/Los_Angeles' },
  { label: 'Brazil (BRT)', value: 'America/Sao_Paulo' },
  { label: 'Argentina (ART)', value: 'America/Argentina/Buenos_Aires' },
];

export function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

export function getLocalDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(date);
}

export function formatLocalDayLabel(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }).format(date);
}

export function getTimezoneLabel(tz: string): string {
  const match = TIMEZONE_OPTIONS.find((t) => t.value === tz);
  if (match) return match.label;
  // For unlisted zones, show a readable offset
  const offset = new Intl.DateTimeFormat('en', {
    timeZoneName: 'shortOffset',
    timeZone: tz,
  })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value ?? tz;
  return `${tz} (${offset})`;
}
