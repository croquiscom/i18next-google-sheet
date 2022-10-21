export interface SheetEntryValues {
  namespace: string;
  key: string;
  suffix: string | null;
  used: string;
  created_at: string;
  // 이 외에도 ko, ja, en 등 언어 코드가 들어갑니다.
}

export interface SheetEntry {
  row_id: number | null;
  namespace: string;
  key: string;
  suffix: string | null;
  values: Record<string, string | null> & SheetEntryValues;
  has_changed: boolean;
  has_visited: boolean;
  raw_values: string[] | null;
}

export interface SheetEntryKey {
  namespace: string;
  key: string;
  suffix: string | null;
}
