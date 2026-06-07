export interface TimeRange {
  start: number; // UTC timestamp ms
  end: number;   // UTC timestamp ms
}

export interface Person {
  id: string;
  name: string;
  color: string;
  ranges: TimeRange[];
}
