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
}

export async function i18nextGoogleSheet(options: I18nextGoogleSheetOptions): Promise<ProcessStats> {
  const stats = createProcessStats();
  const googleClient = await createGoogleAuth(options.credentials_file, options.credentials_json);
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
  await oraPromise(
    saveFileLocale(options.path, file_locale),
    'Saving file locales',
  );
  await oraPromise(
    saveSheetLocale(sheets, options.spreadsheet_id, options.range, columns, sheet_locale),
    'Saving sheet locales',
  );
  return stats;
}

export default i18nextGoogleSheet;
