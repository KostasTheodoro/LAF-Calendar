// The weekend window is always Fri 19:00 → Mon 00:00 SAST (UTC+2)
// In UTC: Fri 17:00 → Sun 22:00

export function getWeekendWindow(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat

  const daysSinceFriday = (day + 7 - 5) % 7;

  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - daysSinceFriday);
  start.setUTCHours(17, 0, 0, 0); // Fri 17:00 UTC = Fri 19:00 SAST

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 2);
  end.setUTCHours(22, 0, 0, 0); // Sun 22:00 UTC = Mon 00:00 SAST

  if (now > end) {
    start.setUTCDate(start.getUTCDate() + 7);
    end.setUTCDate(end.getUTCDate() + 7);
  }

  return { start, end };
}

export function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(date);
}

export function getSASTDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Africa/Johannesburg',
  }).format(date);
}
