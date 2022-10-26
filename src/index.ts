import { google } from 'googleapis';
import { oraPromise } from 'ora';
import yargs from 'yargs';
import { loadFileLocale, saveFileLocale } from './fileLocaleIO.js';
import { createGoogleAuth } from './googleAuth.js';
import { pruneSheetLocale } from './prune.js';
import { loadSheetLocale, saveSheetLocale } from './sheetLocaleIO.js';
import { visitLocale } from './visitor.js';

async function main() {
  const argv = await yargs(process.argv.slice(2))
    .option('path', {
      alias: 'p',
      describe: '로컬 locales 폴더 경로',
      type: 'string',
    })
    .option('range', {
      describe: '구글 시트에서 스캔할 범위',
      default: '시트1',
      type: 'string',
    })
    .option('spreadsheet-id', {
      describe: '구글 시트 문서 ID',
      type: 'string',
    })
    .option('credentials-file', {
      describe: '구글 API 인증 파일',
      type: 'string',
    })
    .option('credentials-json', {
      describe: '구글 API 인증 JSON',
      type: 'string',
    })
    .demandOption(['path', 'range', 'spreadsheet-id'])
    .env('I18NEXT')
    .help('h')
    .alias('h', 'help')
    .argv;
  const googleClient = await createGoogleAuth(argv.credentialsFile, argv.credentialsJson);
  const sheets = google.sheets({ version: 'v4', auth: googleClient });
  const file_locale = await oraPromise(
    loadFileLocale(argv.path),
    'Loading file locales',
  );
  const { columns, locale: sheet_locale } = await oraPromise(
    loadSheetLocale(sheets, argv.spreadsheetId, argv.range),
    'Loading sheet locales',
  );
  visitLocale(file_locale, sheet_locale);
  pruneSheetLocale(sheet_locale);
  await oraPromise(
    saveFileLocale(argv.path, file_locale),
    'Saving file locales',
  );
  await oraPromise(
    saveSheetLocale(sheets, argv.spreadsheetId, argv.range, columns, sheet_locale),
    'Saving sheet locales',
  );
}

main();
