import { SheetEntry, SheetEntryKey } from './sheetEntry';

export class SheetLocale {
  entries: SheetEntry[] = [];
  index: Map<string, SheetEntry> = new Map();

  getIndexKey(key: SheetEntryKey): string {
    let index_key = key.namespace + '$$' + key.key;
    if (key.suffix) {
      index_key += '_' + key.suffix;
    }
    return index_key;
  }

  get(key: SheetEntryKey): SheetEntry | null {
    return this.index.get(this.getIndexKey(key)) ?? null;
  }

  insert(entry: SheetEntry): void {
    this.entries.push(entry);
    this.index.set(this.getIndexKey(entry), entry);
  }

  insertAll(entries: SheetEntry[]): void {
    entries.forEach((entry) => this.insert(entry));
  }
}
