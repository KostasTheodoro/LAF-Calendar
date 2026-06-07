'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { TimeRange } from '@/lib/types';
import { formatTime, getLocalDateString, formatLocalDayLabel } from '@/lib/timezones';

const STEP_MS = 30 * 60 * 1000;

interface Props {
  weekendStart: Date;
  weekendEnd: Date;
  timezone: string;
  ranges: TimeRange[];
  onUpdateRanges: (ranges: TimeRange[]) => void;
  onDone: () => void;
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

export default function PersonalPicker({
  weekendStart,
  weekendEnd,
  timezone,
  ranges,
  onUpdateRanges,
  onDone,
}: Props) {
  const [dragPreview, setDragPreview] = useState<{
    anchorTs: number;
    currentTs: number;
    mode: 'add' | 'remove';
  } | null>(null);

  const dragRef = useRef<{ anchorTs: number; mode: 'add' | 'remove' } | null>(null);
  const rangesRef = useRef(ranges);
  rangesRef.current = ranges;
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

  useEffect(() => {
    setStickyDay(formatLocalDayLabel(weekendStart, timezone));
    dayHeaderRefs.current.clear();
  }, [timezone, weekendStart]);

  const handleScroll = useCallback(() => {
    const header = columnHeaderRef.current;
    if (!header) return;
    const headerBottom = header.getBoundingClientRect().bottom;
    let current = '';
    for (const [label, el] of dayHeaderRefs.current) {
      if (el.getBoundingClientRect().top < headerBottom) current = label;
    }
    if (current) setStickyDay(current);
  }, []);

  const steps: number[] = [];
  for (let ts = weekendStart.getTime(); ts < weekendEnd.getTime(); ts += STEP_MS) {
    steps.push(ts);
  }

  const dayBoundaries = new Map<number, string>();
  let lastDate = '';
  for (let i = 0; i < steps.length; i++) {
    const d = getLocalDateString(new Date(steps[i]), timezone);
    if (d !== lastDate) {
      dayBoundaries.set(i, formatLocalDayLabel(new Date(steps[i]), timezone));
      lastDate = d;
    }
  }

  const handleMouseDown = useCallback((ts: number) => {
    const mode = isTimeCovered(ts, rangesRef.current) ? 'remove' : 'add';
    dragRef.current = { anchorTs: ts, mode };
    setDragPreview({ anchorTs: ts, currentTs: ts, mode });
  }, []);

  const handleMouseEnter = useCallback((ts: number) => {
    if (!dragRef.current) return;
    setDragPreview((prev) => (prev ? { ...prev, currentTs: ts } : null));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    const preview = dragPreviewRef.current;
    if (preview) {
      onUpdateRanges(
        applyDrag(rangesRef.current, preview.anchorTs, preview.currentTs, preview.mode)
      );
    }
    dragRef.current = null;
    setDragPreview(null);
  }, [onUpdateRanges]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const rows: ReactNode[] = [];

  for (let i = 0; i < steps.length; i++) {
    const ts = steps[i];
    const date = new Date(ts);
    const isHourMark = i % 2 === 0;
    const dayLabel = dayBoundaries.get(i);

    if (dayLabel) {
      rows.push(
        <div
          key={`day-${i}`}
          ref={(el) => {
            if (el) dayHeaderRefs.current.set(dayLabel, el);
            else dayHeaderRefs.current.delete(dayLabel);
          }}
          className="flex items-center gap-3 bg-gray-800/50 border-y border-gray-700/40 px-4 py-2"
        >
          <div className="w-16 flex-shrink-0" />
          <span className="text-xs font-bold tracking-widest uppercase text-gray-400">
            {dayLabel}
          </span>
        </div>
      );
    }

    let inPreview = false;
    let previewMode: 'add' | 'remove' = 'add';
    if (dragPreview) {
      const pStart = Math.min(dragPreview.anchorTs, dragPreview.currentTs);
      const pEnd = Math.max(dragPreview.anchorTs, dragPreview.currentTs) + STEP_MS;
      inPreview = ts >= pStart && ts < pEnd;
      previewMode = dragPreview.mode;
    }

    const covered = isTimeCovered(ts, ranges);

    rows.push(
      <div
        key={`step-${ts}`}
        className={`flex items-stretch border-b ${
          isHourMark ? 'border-gray-800 h-8' : 'border-gray-900/50 h-6'
        }`}
      >
        {/* Time label */}
        <div className="w-16 flex-shrink-0 flex items-center justify-end pr-3">
          {isHourMark && (
            <span className="text-xs text-gray-500 tabular-nums">
              {formatTime(date, timezone)}
            </span>
          )}
        </div>

        {/* Availability cell */}
        <div
          className={`flex-1 cursor-crosshair transition-colors border-l border-gray-800 ${
            inPreview
              ? previewMode === 'add'
                ? 'bg-green-500/60'
                : 'bg-red-900/40'
              : covered
              ? 'bg-green-500/30 hover:bg-green-500/40'
              : 'hover:bg-green-900/15'
          }`}
          onMouseDown={() => handleMouseDown(ts)}
          onMouseEnter={() => handleMouseEnter(ts)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">
            Click and drag to mark when you&apos;re free. Drag over a block to remove it.
          </p>
        </div>
        <button
          onClick={onDone}
          className="bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors flex items-center gap-2"
        >
          See group availability →
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-auto rounded-xl border border-gray-800 bg-gray-950"
        style={{ maxHeight: '65vh' }}
      >
        {/* Header */}
        <div ref={columnHeaderRef} className="sticky top-0 z-10 flex bg-gray-900 border-b border-gray-700 shadow-md">
          <div className="w-16 flex-shrink-0 px-2 py-2.5 text-[11px] text-gray-600 flex items-center justify-end">
            local
          </div>
          <div className="flex-1 px-4 py-2.5 text-sm font-semibold text-green-400 border-l border-gray-700">
            When are you free?
          </div>
        </div>

        {/* Sticky day indicator */}
        <div
          className="sticky z-[9] flex items-center bg-gray-950/95 border-b border-gray-800 px-4 py-1"
          style={{ top: `${headerHeight}px` }}
        >
          <div className="w-16 flex-shrink-0" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-gray-500">
            {stickyDay}
          </span>
        </div>

        {/* Grid */}
        <div className="select-none">{rows}</div>
      </div>
    </div>
  );
}
