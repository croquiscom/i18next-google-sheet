import { google } from 'googleapis';
import yargs from 'yargs';
import { loadFileLocale, saveFileLocale } from './fileLocaleIO';
import { createGoogleAuth } from './googleAuth';
import { pruneSheetLocale } from './prune';
import { loadSheetLocale, saveSheetLocale } from './sheetLocaleIO';
import { visitLocale } from './visitor';

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
  console.log('Loading file locales...');
  const file_locale = await loadFileLocale(argv.path);
  console.log('Loading sheet locales...');
  const { columns, locale: sheet_locale } = await loadSheetLocale(sheets, argv.spreadsheetId, argv.range);
  visitLocale(file_locale, sheet_locale);
  pruneSheetLocale(sheet_locale);
  console.log('Saving file locales...');
  await saveFileLocale(argv.path, file_locale);
  console.log('Saving sheet locales...');
  await saveSheetLocale(sheets, argv.spreadsheetId, argv.range, columns, sheet_locale);
}

main();
