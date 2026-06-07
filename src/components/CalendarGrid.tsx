'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Person, TimeRange } from '@/lib/types';
import { formatTime, getLocalDateString, formatLocalDayLabel } from '@/lib/timezones';

const STEP_MS = 60 * 60 * 1000;

interface Props {
  weekendStart: Date;
  weekendEnd: Date;
  currentUser: { name: string; timezone: string } | null;
  userRanges: TimeRange[];
  people: Person[];
  onUpdateRanges: (ranges: TimeRange[]) => void;
}

function isTimeCovered(ts: number, ranges: TimeRange[]): boolean {
  return ranges.some((r) => ts >= r.start && ts < r.end);
}

function applyDrag(
  ranges: TimeRange[],
  dragStart: number,
  dragEnd: number,
  mode: 'add' | 'remove'
): TimeRange[] {
  const start = Math.min(dragStart, dragEnd);
  const end = Math.max(dragStart, dragEnd) + STEP_MS;

  if (mode === 'remove') {
    const result: TimeRange[] = [];
    for (const r of ranges) {
      if (r.end <= start || r.start >= end) {
        result.push(r);
      } else {
        if (r.start < start) result.push({ start: r.start, end: start });
        if (r.end > end) result.push({ start: end, end: r.end });
      }
    }
    return result;
  }

  const merged = [...ranges, { start, end }].sort((a, b) => a.start - b.start);
  const result: TimeRange[] = [];
  for (const r of merged) {
    if (!result.length || result[result.length - 1].end < r.start) {
      result.push({ ...r });
    } else {
      result[result.length - 1].end = Math.max(result[result.length - 1].end, r.end);
    }
  }
  return result;
}

function getOverlapStyle(count: number, total: number): string {
  if (count === 0 || total === 0) return '';
  const ratio = count / total;
  if (ratio <= 0.33) return 'bg-blue-800/50';
  if (ratio <= 0.66) return 'bg-violet-600/60';
  return 'bg-amber-400/75';
}

export default function CalendarGrid({
  weekendStart,
  weekendEnd,
  currentUser,
  userRanges,
  people,
  onUpdateRanges,
}: Props) {
  const displayTZ = currentUser?.timezone ?? 'Africa/Johannesburg';

  const [dragPreview, setDragPreview] = useState<{
    anchorTs: number;
    currentTs: number;
    mode: 'add' | 'remove';
  } | null>(null);

  const dragRef = useRef<{ anchorTs: number; mode: 'add' | 'remove' } | null>(null);
  const userRangesRef = useRef(userRanges);
  userRangesRef.current = userRanges;
  const dragPreviewRef = useRef(dragPreview);
  dragPreviewRef.current = dragPreview;

  // Sticky day tracking
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnHeaderRef = useRef<HTMLDivElement>(null);
  const dayHeaderRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [stickyDay, setStickyDay] = useState('');
  const [headerHeight, setHeaderHeight] = useState(37);

  useLayoutEffect(() => {
    if (columnHeaderRef.current) {
      setHeaderHeight(columnHeaderRef.current.offsetHeight);
    }
  }, []);

  // Initialise sticky day to the first day label when timezone changes
  useEffect(() => {
    setStickyDay(formatLocalDayLabel(weekendStart, displayTZ));
    dayHeaderRefs.current.clear();
  }, [displayTZ, weekendStart]);

  const handleScroll = useCallback(() => {
    const header = columnHeaderRef.current;
    if (!header) return;
    const headerBottom = header.getBoundingClientRect().bottom;
    let current = '';
    for (const [label, el] of dayHeaderRefs.current) {
      if (el.getBoundingClientRect().top < headerBottom) {
        current = label;
      }
    }
    if (current) setStickyDay(current);
  }, []);

  // All people including current user
  const allPeople = [
    ...people,
    ...(currentUser
      ? [{ id: 'current', name: currentUser.name, color: '#22c55e', ranges: userRanges }]
      : []),
  ];
  const totalPeople = allPeople.length;

  // Time steps across the weekend
  const steps: number[] = [];
  for (let ts = weekendStart.getTime(); ts < weekendEnd.getTime(); ts += STEP_MS) {
    steps.push(ts);
  }

  const overlapCounts = steps.map((ts) =>
    allPeople.filter((p) => isTimeCovered(ts, p.ranges)).length
  );

  // Day boundaries in user's local timezone
  const dayBoundaries = new Map<number, string>();
  let lastLocalDate = '';
  for (let i = 0; i < steps.length; i++) {
    const d = getLocalDateString(new Date(steps[i]), displayTZ);
    if (d !== lastLocalDate) {
      dayBoundaries.set(i, formatLocalDayLabel(new Date(steps[i]), displayTZ));
      lastLocalDate = d;
    }
  }

  const handleMouseDown = useCallback(
    (ts: number) => {
      if (!currentUser) return;
      const mode = isTimeCovered(ts, userRangesRef.current) ? 'remove' : 'add';
      dragRef.current = { anchorTs: ts, mode };
      setDragPreview({ anchorTs: ts, currentTs: ts, mode });
    },
    [currentUser]
  );

  const handleMouseEnter = useCallback((ts: number) => {
    if (!dragRef.current) return;
    setDragPreview((prev) => (prev ? { ...prev, currentTs: ts } : null));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    const preview = dragPreviewRef.current;
    if (preview) {
      onUpdateRanges(
        applyDrag(userRangesRef.current, preview.anchorTs, preview.currentTs, preview.mode)
      );
    }
    dragRef.current = null;
    setDragPreview(null);
  }, [onUpdateRanges]);

  const handleMouseDownRef = useRef(handleMouseDown);
  handleMouseDownRef.current = handleMouseDown;
  const handleMouseEnterRef = useRef(handleMouseEnter);
  handleMouseEnterRef.current = handleMouseEnter;
  const handleMouseUpRef = useRef(handleMouseUp);
  handleMouseUpRef.current = handleMouseUp;

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseUp]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      const tsAttr = (e.target as HTMLElement).closest('[data-ts]')?.getAttribute('data-ts');
      if (!tsAttr) return;
      e.preventDefault();
      handleMouseDownRef.current(Number(tsAttr));
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const tsAttr = elem?.closest('[data-ts]')?.getAttribute('data-ts');
      if (tsAttr) handleMouseEnterRef.current(Number(tsAttr));
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // Build grid rows
  const rows: ReactNode[] = [];

  for (let i = 0; i < steps.length; i++) {
    const ts = steps[i];
    const date = new Date(ts);
    const dayLabel = dayBoundaries.get(i);

    if (dayLabel) {
      rows.push(
        <div
          key={`day-${i}`}
          ref={(el) => {
            if (el) dayHeaderRefs.current.set(dayLabel, el);
            else dayHeaderRefs.current.delete(dayLabel);
          }}
          className="flex items-center gap-3 bg-gray-800/50 border-y border-gray-700/40 px-3 py-2"
        >
          <div className="w-14 flex-shrink-0" />
          <span className="text-xs font-bold tracking-widest uppercase text-gray-400">
            {dayLabel}
          </span>
        </div>
      );
    }

    let inPreview = false;
    let previewMode: 'add' | 'remove' = 'add';
    if (dragPreview) {
      const previewStart = Math.min(dragPreview.anchorTs, dragPreview.currentTs);
      const previewEnd = Math.max(dragPreview.anchorTs, dragPreview.currentTs) + STEP_MS;
      inPreview = ts >= previewStart && ts < previewEnd;
      previewMode = dragPreview.mode;
    }

    const userCovered = isTimeCovered(ts, userRanges);

    rows.push(
      <div
        key={`step-${ts}`}
        className="flex items-stretch border-b border-gray-800 h-10"
      >
        <div className="w-14 flex-shrink-0 flex items-center justify-end pr-2">
          <span className="text-[11px] text-gray-500 tabular-nums">
            {formatTime(date, displayTZ)}
          </span>
        </div>

        <div
          data-ts={currentUser ? ts : undefined}
          className={`flex-1 min-w-[100px] border-l border-gray-800 ${
            currentUser ? 'cursor-crosshair' : ''
          } transition-colors ${
            inPreview
              ? previewMode === 'add'
                ? 'bg-green-500/55'
                : 'bg-red-900/40'
              : userCovered
              ? 'bg-green-500/28 hover:bg-green-500/38'
              : currentUser
              ? 'hover:bg-white/[0.03]'
              : 'bg-gray-900/30'
          }`}
          onMouseDown={currentUser ? () => handleMouseDown(ts) : undefined}
          onMouseEnter={currentUser ? () => handleMouseEnter(ts) : undefined}
        />

        {people.map((person) => (
          <div
            key={person.id}
            className="flex-1 min-w-[90px] border-l border-gray-800"
            style={{
              backgroundColor: isTimeCovered(ts, person.ranges)
                ? `${person.color}30`
                : undefined,
            }}
          />
        ))}

        <div
          className={`flex-1 min-w-[90px] border-l border-gray-700 ${getOverlapStyle(
            overlapCounts[i],
            totalPeople
          )}`}
        />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="relative overflow-auto rounded-xl border border-gray-800 bg-gray-950"
      style={{ maxHeight: '68vh' }}
    >
      {/* Column name headers — sticky at very top */}
      <div ref={columnHeaderRef} className="sticky top-0 z-10 flex bg-gray-900 border-b border-gray-700 shadow-md">
        <div className="w-14 flex-shrink-0 p-2 text-[11px] text-gray-600 flex items-center justify-end pr-2">
          {displayTZ === 'Africa/Johannesburg' ? 'SAST' : 'local'}
        </div>

        {currentUser ? (
          <div className="flex-1 min-w-[100px] px-2 py-2 text-center text-xs font-bold text-green-400 border-l border-gray-700">
            {currentUser.name} <span className="font-normal text-green-700">(you)</span>
          </div>
        ) : (
          <div className="flex-1 min-w-[100px] px-2 py-2 text-center text-xs text-gray-600 border-l border-gray-700 italic">
            enter name ↑
          </div>
        )}

        {people.map((person) => (
          <div
            key={person.id}
            className="flex-1 min-w-[90px] px-2 py-2 text-center text-xs font-bold border-l border-gray-700"
            style={{ color: person.color }}
          >
            {person.name}
          </div>
        ))}

        <div className="flex-1 min-w-[90px] px-2 py-2 text-center text-xs font-bold text-gray-400 border-l border-gray-700">
          Overlap
        </div>
      </div>

      {/* Sticky current-day indicator — sits just below the column header */}
      <div
        className="sticky z-[9] flex items-center bg-gray-950/95 border-b border-gray-800 px-3 py-1"
        style={{ top: `${headerHeight}px` }}
      >
        <div className="w-14 flex-shrink-0" />
        <span className="text-[11px] font-semibold tracking-widest uppercase text-gray-500">
          {stickyDay}
        </span>
      </div>

      {/* Grid */}
      <div className="select-none">{rows}</div>
    </div>
  );
}
