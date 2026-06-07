'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Person, TimeRange } from '@/lib/types';
import { getWeekendWindow, formatDayLabel } from '@/lib/weekend';
import { detectTimezone, getTimezoneLabel, TIMEZONE_OPTIONS } from '@/lib/timezones';
import { supabase } from '@/lib/supabase';
import type { AvailabilityRow } from '@/lib/supabase';
import { fetchWeekendAvailability, saveAvailability, assignColor } from '@/lib/db';
import PersonalPicker from '@/components/PersonalPicker';
import CalendarGrid from '@/components/CalendarGrid';

type Phase = 'name' | 'pick' | 'compare';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [weekendWindow, setWeekendWindow] = useState<{ start: Date; end: Date } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>('name');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Africa/Johannesburg');
  const [showTZPicker, setShowTZPicker] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; timezone: string; color: string } | null>(null);
  const [userRanges, setUserRanges] = useState<TimeRange[]>([]);

  // Refs so real-time callbacks always see latest values
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // On mount: get weekend window, detect timezone, restore name from localStorage
  useEffect(() => {
    setMounted(true);
    const ww = getWeekendWindow();
    setWeekendWindow(ww);
    setTimezone(detectTimezone());

    const saved = localStorage.getItem('laf-user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name) setName(parsed.name);
        if (parsed.timezone) setTimezone(parsed.timezone);
      } catch {
        localStorage.removeItem('laf-user');
      }
    }
  }, []);

  // Once weekend window is known: fetch people + subscribe to real-time
  useEffect(() => {
    if (!weekendWindow) return;
    const weekendStartMs = weekendWindow.start.getTime();
    let cancelled = false;

    fetchWeekendAvailability(weekendStartMs)
      .then((data) => {
        if (cancelled) return;
        setPeople(data);

        // Try to restore current user from localStorage
        const saved = localStorage.getItem('laf-user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.name && parsed.color) {
              const existing = data.find(
                (p) => p.name.toLowerCase() === parsed.name.toLowerCase()
              );
              if (existing) {
                setCurrentUser({
                  name: existing.name,
                  timezone: parsed.timezone ?? 'Africa/Johannesburg',
                  color: existing.color,
                });
                setUserRanges(existing.ranges);
                setPhase(parsed.phase ?? 'pick');
              }
            }
          } catch {
            // ignore bad localStorage
          }
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });

    // Real-time subscription
    const channel = supabase
      .channel(`availability-${weekendStartMs}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability',
          filter: `weekend_start=eq.${weekendStartMs}`,
        },
        (payload: RealtimePostgresChangesPayload<AvailabilityRow>) => {
          const cu = currentUserRef.current;

          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<AvailabilityRow>;
            setPeople((prev) => prev.filter((p) => p.id !== old.id));
            return;
          }

          const row = payload.new as AvailabilityRow;
          // Don't overwrite the current user's live editing state
          if (cu && row.name.toLowerCase() === cu.name.toLowerCase()) return;

          const person: Person = {
            id: row.id,
            name: row.name,
            color: row.color,
            ranges: row.ranges,
          };

          setPeople((prev) => {
            const idx = prev.findIndex((p) => p.id === row.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = person;
              return next;
            }
            return [...prev, person];
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [weekendWindow]);

  // Auto-save ranges to Supabase with debounce (1.2s after last change)
  useEffect(() => {
    if (!currentUser || !weekendWindow) return;
    const timer = setTimeout(async () => {
      try {
        await saveAvailability({
          weekendStart: weekendWindow.start.getTime(),
          name: currentUser.name,
          timezone: currentUser.timezone,
          color: currentUser.color,
          ranges: userRanges,
        });
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [userRanges, currentUser, weekendWindow]);

  // Persist user info (not ranges — Supabase owns those)
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(
        'laf-user',
        JSON.stringify({
          name: currentUser.name,
          timezone: currentUser.timezone,
          color: currentUser.color,
          phase,
        })
      );
    }
  }, [currentUser, phase]);

  async function handleJoin() {
    if (!name.trim() || !weekendWindow) return;
    const trimmedName = name.trim();

    const existing = people.find((p) => p.name.toLowerCase() === trimmedName.toLowerCase());
    const color = existing ? existing.color : assignColor(people.map((p) => p.color));

    setCurrentUser({ name: trimmedName, timezone, color });
    setUserRanges(existing?.ranges ?? []);
    setPhase('pick');
  }

  async function handlePickerDone() {
    if (!currentUser || !weekendWindow) return;
    try {
      await saveAvailability({
        weekendStart: weekendWindow.start.getTime(),
        name: currentUser.name,
        timezone: currentUser.timezone,
        color: currentUser.color,
        ranges: userRanges,
      });
    } catch (err) {
      console.error('Save failed:', err);
    }
    setPhase('compare');
  }

  function handleReset() {
    setCurrentUser(null);
    setUserRanges([]);
    setPhase('name');
    localStorage.removeItem('laf-user');
  }

  if (!mounted || !weekendWindow) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  const windowLabel = `${formatDayLabel(weekendWindow.start)} 19:00 → ${formatDayLabel(weekendWindow.end)} 00:00 SAST`;
  const otherPeople = currentUser
    ? people.filter((p) => p.name.toLowerCase() !== currentUser.name.toLowerCase())
    : people;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-1">LAF Calendar</h1>
          <p className="text-sm text-gray-500">{windowLabel}</p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
            Loading...
          </div>
        )}

        {/* ── Phase: name entry ── */}
        {!loading && phase === 'name' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleJoin(); }}
            className="flex flex-wrap gap-3 items-end"
          >
            <div>
              <label className="block text-xs text-gray-400 mb-1">Your name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={30}
                autoFocus
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 w-48"
              />
            </div>

            <div className="relative">
              <label className="block text-xs text-gray-400 mb-1">Timezone (auto-detected)</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 max-w-[220px] truncate">
                  {getTimezoneLabel(timezone)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowTZPicker((v) => !v)}
                  className="text-xs text-gray-500 hover:text-gray-300 underline"
                >
                  change
                </button>
              </div>
              {showTZPicker && (
                <select
                  value={timezone}
                  onChange={(e) => { setTimezone(e.target.value); setShowTZPicker(false); }}
                  size={7}
                  className="absolute top-full mt-1 left-0 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none w-72 z-20 shadow-xl"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="submit"
              className="bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
            >
              Continue →
            </button>
          </form>
        )}

        {/* ── Phase: personal picker ── */}
        {phase === 'pick' && currentUser && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentUser.color }} />
              <span className="text-sm text-white font-semibold">{currentUser.name}</span>
              <span className="text-xs text-gray-500">{getTimezoneLabel(currentUser.timezone)}</span>
              <button onClick={handleReset} className="text-xs text-gray-600 hover:text-gray-400 underline ml-1">
                Edit info
              </button>
            </div>

            <PersonalPicker
              weekendStart={weekendWindow.start}
              weekendEnd={weekendWindow.end}
              timezone={currentUser.timezone}
              ranges={userRanges}
              onUpdateRanges={setUserRanges}
              onDone={handlePickerDone}
            />
          </>
        )}

        {/* ── Phase: comparison grid ── */}
        {phase === 'compare' && currentUser && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentUser.color }} />
                <span className="text-sm text-white font-semibold">{currentUser.name}</span>
                <span className="text-xs text-gray-500">{getTimezoneLabel(currentUser.timezone)}</span>
                <button onClick={handleReset} className="text-xs text-gray-600 hover:text-gray-400 underline ml-1">
                  Edit info
                </button>
              </div>
              <button
                onClick={() => setPhase('pick')}
                className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
              >
                ← Edit my times
              </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-5 mb-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(34,197,94,0.28)' }} />
                Your availability
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded inline-block bg-blue-800/50" />
                Some overlap
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded inline-block bg-violet-600/60" />
                Good overlap
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded inline-block bg-amber-400/75" />
                Peak overlap
              </span>
            </div>

            <CalendarGrid
              weekendStart={weekendWindow.start}
              weekendEnd={weekendWindow.end}
              currentUser={currentUser}
              userRanges={userRanges}
              people={otherPeople}
              onUpdateRanges={setUserRanges}
            />
          </>
        )}
      </div>
    </main>
  );
}
