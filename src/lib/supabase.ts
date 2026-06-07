import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface AvailabilityRow {
  id: string;
  weekend_start: number;
  name: string;
  timezone: string;
  color: string;
  ranges: { start: number; end: number }[];
  updated_at: string;
}
