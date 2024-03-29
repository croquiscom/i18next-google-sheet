import { google } from 'googleapis';
import { oraPromise } from 'ora';
import { loadFileLocale, saveFileLocale } from './fileLocaleIO.js';
import { createGoogleAuth } from './googleAuth.js';
import { pruneSheetLocale } from './prune.js';
import { loadSheetLocale, saveSheetLocale } from './sheetLocaleIO.js';
import { createProcessStats, ProcessStats } from './types.js';
import { visitLocale } from './visitor.js';

export interface I18nextGoogleSheetOptions {
  path: string;
  range: string;
  spreadsheet_id: string;
  credentials_file?: string;
  credentials_json?: string; 
  oauth_client_file?: string;
  escape_non_printable_unicode_characters?: boolean;
  action?: 'sync' | 'push' | 'pull'
}

export async function i18nextGoogleSheet(options: I18nextGoogleSheetOptions): Promise<ProcessStats> {
  const stats = createProcessStats();
  const googleClient = await createGoogleAuth(
    options.credentials_file,
    options.credentials_json,
    options.oauth_client_file,
  );
  const sheets = google.sheets({ version: 'v4', auth: googleClient });
  const file_locale = await oraPromise(
    loadFileLocale(options.path),
    'Loading file locales',
  );
  const { columns, locale: sheet_locale } = await oraPromise(
    loadSheetLocale(sheets, options.spreadsheet_id, options.range),
    'Loading sheet locales',
  );
  visitLocale(file_locale, sheet_locale, stats);
  pruneSheetLocale(sheet_locale, stats);

  switch (options.action) {
    case 'pull':
      await oraPromise(saveFileLocale(options.path, file_locale, options.escape_non_printable_unicode_characters), 'Saving file locales');
      break;

    case 'push':
      await oraPromise(saveSheetLocale(sheets, options.spreadsheet_id, options.range, columns, sheet_locale), 'Saving sheet locales');
      break;

    case 'sync':
    default:
      await oraPromise(saveFileLocale(options.path, file_locale, options.escape_non_printable_unicode_characters), 'Saving file locales');
      await oraPromise(saveSheetLocale(sheets, options.spreadsheet_id, options.range, columns, sheet_locale), 'Saving sheet locales');
      break;
  }

  return stats;
}

export default i18nextGoogleSheet;
