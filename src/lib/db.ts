import { supabase } from './supabase';
import type { AvailabilityRow } from './supabase';
import type { Person, TimeRange } from './types';

const PERSON_COLORS = [
  '#818cf8', // indigo
  '#fb923c', // orange
  '#f472b6', // pink
  '#34d399', // emerald
  '#60a5fa', // blue
  '#fbbf24', // amber
  '#a78bfa', // violet
];

export function assignColor(usedColors: string[]): string {
  const used = new Set(usedColors);
  return PERSON_COLORS.find((c) => !used.has(c)) ?? PERSON_COLORS[usedColors.length % PERSON_COLORS.length];
}

function rowToPerson(row: AvailabilityRow): Person {
  return { id: row.id, name: row.name, color: row.color, ranges: row.ranges };
}

export async function fetchWeekendAvailability(weekendStart: number): Promise<Person[]> {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('weekend_start', weekendStart);

  if (error) throw error;
  return (data as AvailabilityRow[]).map(rowToPerson);
}

export async function saveAvailability(params: {
  weekendStart: number;
  name: string;
  timezone: string;
  color: string;
  ranges: TimeRange[];
}): Promise<void> {
  const { error } = await supabase.from('availability').upsert(
    {
      weekend_start: params.weekendStart,
      name: params.name,
      timezone: params.timezone,
      color: params.color,
      ranges: params.ranges,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'weekend_start,name' }
  );

  if (error) throw error;
}
