'use client';

import { useEffect, useState } from 'react';
import type { Person, TimeRange } from '@/lib/types';
import { getWeekendWindow, formatDayLabel } from '@/lib/weekend';
import { detectTimezone, getTimezoneLabel, TIMEZONE_OPTIONS } from '@/lib/timezones';
import PersonalPicker from '@/components/PersonalPicker';
import CalendarGrid from '@/components/CalendarGrid';

type Phase = 'name' | 'pick' | 'compare';

function buildMockRanges(weekendStartMs: number): Person[] {
  const h = (hours: number) => weekendStartMs + hours * 60 * 60 * 1000;
  return [
    {
      id: 'alice',
      name: 'Alice',
      color: '#818cf8',
      ranges: [
        { start: h(0), end: h(4) },
        { start: h(15), end: h(23) },
        { start: h(43), end: h(51) },
      ],
    },
    {
      id: 'marcus',
      name: 'Marcus',
      color: '#fb923c',
      ranges: [
        { start: h(1), end: h(3) },
        { start: h(13), end: h(17) },
        { start: h(21), end: h(28) },
        { start: h(35), end: h(45) },
      ],
    },
    {
      id: 'yuki',
      name: 'Yuki',
      color: '#f472b6',
      ranges: [
        { start: h(17), end: h(25) },
        { start: h(29), end: h(33) },
      ],
    },
  ];
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [weekendWindow, setWeekendWindow] = useState<{ start: Date; end: Date } | null>(null);
  const [mockPeople, setMockPeople] = useState<Person[]>([]);

  const [phase, setPhase] = useState<Phase>('name');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Africa/Johannesburg');
  const [showTZPicker, setShowTZPicker] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; timezone: string } | null>(null);
  const [userRanges, setUserRanges] = useState<TimeRange[]>([]);

  useEffect(() => {
    setMounted(true);
    const ww = getWeekendWindow();
    setWeekendWindow(ww);
    setMockPeople(buildMockRanges(ww.start.getTime()));
    setTimezone(detectTimezone());

    const saved = localStorage.getItem('laf-user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed.user);
        setUserRanges(parsed.ranges ?? []);
        setName(parsed.user.name);
        setTimezone(parsed.user.timezone);
        setPhase(parsed.phase ?? 'pick');
      } catch {
        localStorage.removeItem('laf-user');
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(
        'laf-user',
        JSON.stringify({ user: currentUser, ranges: userRanges, phase })
      );
    }
  }, [currentUser, userRanges, phase]);

  function handleJoin() {
    if (!name.trim()) return;
    setCurrentUser({ name: name.trim(), timezone });
    setPhase('pick');
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

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-1">LAF Calendar</h1>
          <p className="text-sm text-gray-500">{windowLabel}</p>
        </div>

        {/* ── Phase: name entry ── */}
        {phase === 'name' && (
          <form onSubmit={(e) => { e.preventDefault(); handleJoin(); }} className="flex flex-wrap gap-3 items-end">
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
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
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
            {/* User bar */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm text-white font-semibold">{currentUser.name}</span>
                <span className="text-xs text-gray-500">{getTimezoneLabel(currentUser.timezone)}</span>
                <button
                  onClick={handleReset}
                  className="text-xs text-gray-600 hover:text-gray-400 underline ml-1"
                >
                  Edit info
                </button>
              </div>
            </div>

            <PersonalPicker
              weekendStart={weekendWindow.start}
              weekendEnd={weekendWindow.end}
              timezone={currentUser.timezone}
              ranges={userRanges}
              onUpdateRanges={setUserRanges}
              onDone={() => setPhase('compare')}
            />
          </>
        )}

        {/* ── Phase: comparison grid ── */}
        {phase === 'compare' && currentUser && (
          <>
            {/* User bar with edit button */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm text-white font-semibold">{currentUser.name}</span>
                <span className="text-xs text-gray-500">{getTimezoneLabel(currentUser.timezone)}</span>
                <button
                  onClick={handleReset}
                  className="text-xs text-gray-600 hover:text-gray-400 underline ml-1"
                >
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
              mockPeople={mockPeople}
              onUpdateRanges={setUserRanges}
            />
          </>
        )}
      </div>
    </main>
  );
}
