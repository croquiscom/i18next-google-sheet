import { SheetLocale } from './sheetLocale';

export function pruneSheetLocales(sheet_locale: SheetLocale) {
  for (const entry of sheet_locale.entries) {
    if (!entry.has_visited && entry.values.used !== 'FALSE') {
      entry.values.used = 'FALSE';
      entry.has_changed = true;
    }
  }
}
