#!/usr/bin/env node
import yargs from 'yargs';
import chalk from 'chalk';
import { i18nextGoogleSheet } from '../lib/index.js';

function getNamespacesToString(set) {
  const array = Array.from(set);
  if (array.length === 0) return '';
  return ' (' + array.join(', ') + ')';
}

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
    .option('oauth-client-file', {
      describe: '구글 API OAuth 2.0 클라이언트 ID 파일',
      type: 'string',
    })
    .option('escape-non-printable-unicode-characters', {
      describe: '공백이나 컨트롤 문자 (\\u00a0 등)의 이스케이프 처리 여부',
      type: 'boolean',
      default: true
    })
    .demandOption(['path', 'range', 'spreadsheet-id'])
    .env('I18NEXT')
    .help('h')
    .alias('h', 'help')
    .argv;
  
  const stats = await i18nextGoogleSheet({
    path: argv.path,
    range: argv.range,
    spreadsheet_id: argv.spreadsheetId,
    credentials_file: argv.credentialsFile,
    credentials_json: argv.credentialsJson,
    oauth_client_file: argv.oauthClientFile,
    escape_non_printable_unicode_characters: argv.escapeNonPrintableUnicodeCharacters,
  });

  if (['added', 'updated', 'reused', 'pruned'].every((v) => stats[v].count === 0)) {
    console.log('No changes detected');
  } else {
    console.log('Sync complete!');
    console.log(chalk.green('Added: ' + stats.added.count + getNamespacesToString(stats.added.namespaces)));
    console.log(chalk.blue('Updated: ' + stats.updated.count + getNamespacesToString(stats.updated.namespaces)));
    console.log(chalk.yellow('Reused: ' + stats.reused.count + getNamespacesToString(stats.reused.namespaces)));
    console.log(chalk.red('Pruned: ' + stats.pruned.count + getNamespacesToString(stats.pruned.namespaces)));
  }
}

main()
.catch((e) => {
  console.error(chalk.red('Sync failed'));
  console.error(e.stack);
  process.exit(1);
});
