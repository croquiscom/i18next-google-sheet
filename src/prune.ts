import chalk from 'chalk';
import { SheetLocale } from './sheetLocale.js';
import { truncateKey } from './utils.js';

export function pruneSheetLocale(sheet_locale: SheetLocale) {
  for (const entry of sheet_locale.entries) {
    if (!entry.has_visited && entry.values.used !== 'FALSE') {
      entry.values.used = 'FALSE';
      entry.has_changed = true;
      console.log(chalk.red('- pruning'), truncateKey(sheet_locale.getIndexKey(entry)));
    }
  }
}
