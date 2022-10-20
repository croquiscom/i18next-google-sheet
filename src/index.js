const { google } = require('googleapis');
const _ = require('lodash');
const yargs = require('yargs');
const fs = require('fs/promises');
const path = require('path');
const dayjs = require('dayjs');
const mkdirp = require('mkdirp');
const debug = require('debug')('i18next-google-sheet');
const config = require('../config');
const { createGoogleAuth } = require('./createGoogleAuth');

async function loadFileLocales(locales_path) {
  async function scanDir(current_path, current_prefix = [], output = {}) {
    const files = await fs.readdir(current_path, { withFileTypes: true });
    for (const file of files) {
      const file_path = path.resolve(current_path, file.name);
      if (file.isDirectory()) {
        const file_key = [...current_prefix, file.name];
        await scanDir(file_path, file_key, output);
      } else {
        if (file.name.endsWith('_old.json')) {
          // 삭제될 파일로 스킵
          continue;
        }
        const str = await fs.readFile(file_path, 'utf-8');
        const json = JSON.parse(str);
        const file_key = [...current_prefix, file.name.replace(/\.json$/, '')];
        output[file_key.join('/')] = json;
      }
    }
    return output;
  }
  const files = await fs.readdir(locales_path, { withFileTypes: true });
  const locales = {};
  for (const file of files) {
    if (!file.isDirectory()) continue;
    const file_path = path.resolve(locales_path, file.name);
    debug('Reading filesystem language', file.name);
    locales[file.name] = await scanDir(file_path);
  }
  return locales;
}

const SHEET_MAPPING_TABLE = {
  '네임스페이스': 'namespace',
  '번역 키': 'key',
  '유형': 'suffix',
  '사용여부': 'used',
  '한국어': 'values.ko',
  '일본어': 'values.ja',
  '영어': 'values.en',
  '한국어 완료': 'finished.ko',
  '일본어 완료': 'finished.ja',
  '영어 완료': 'finished.en',
  '생성일': 'created_at',
};
const DEFAULT_COLUMNS = [
  'namespace',
  'key',
  'suffix',
  'used',
  'values.ko',
  'values.ja',
  'values.en',
  'finished.ko',
  'finished.ja',
  'finished.en',
];
const SUFFIX_MAPPING_TABLE = {
  '단수': 'one',
  '복수': 'other',
  // NOTE: 아랍어의 경우에는 복수형이 5개 존재하는데, 만약 아랍어를 지원하고자 하는 경우
  // 여기에 zero, one, two, few, many, other 와 같이 정의가 필요합니다.
  '남성': 'male',
  '여성': 'female',
};
const SUFFIX_MAPPING_TABLE_REV = _.invert(SUFFIX_MAPPING_TABLE);

function getSpreadsheetColumns(heading_row) {
  return heading_row.map((row_name) => SHEET_MAPPING_TABLE[row_name] ?? null);
}

async function loadSheetLocales(sheets, spreadsheet_id) {
  debug('Reading spreadsheet');
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: spreadsheet_id,
    ranges: ['\'문자열 목록\''],
  });
  const rows = res.data.valueRanges[0].values;
  const columns = getSpreadsheetColumns(rows[0]);
  const entries = rows.slice(1).map((row, i) => {
    const entry = {
      row: i,
      has_changed: false,
      has_visited: false,
      has_visited_per_lang: {},
      is_new: false,
      raw_values: row,
    };
    columns.forEach((name, j) => {
      if (name == null) return;
      _.set(entry, name, row[j]);
    });
    entry.suffix = SUFFIX_MAPPING_TABLE[entry.suffix] ?? '';
    return entry;
  });
  return {
    columns,
    entries: entries,
    index: makeSheetLocalesIndexMap(entries),
  };
}

function makeSheetLocalesIndexMap(entries) {
  const index_map = new Map();
  entries.forEach((entry) => {
    let index_key = entry.namespace + '$$' + (entry.key ?? '').trim();
    if (entry.suffix) index_key += '_' + entry.suffix;
    index_map.set(index_key, entry);
  });
  return index_map;
}

function appendSheetLocalesRow(sheet_locales, entry) {
  const { entries, index } = sheet_locales;
  const new_entry = {
    row: (entries[entries.length - 1]?.row ?? 0) + 1,
    has_changed: true,
    has_visited: true,
    has_visited_per_lang: {},
    is_new: true,
    created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    values: {},
    finished: {},
    raw_values: [],
    ...entry,
  };
  entries.push(new_entry);
  let index_key = new_entry.namespace + '$$' + new_entry.key.trim();
  if (new_entry.suffix) index_key += '_' + new_entry.suffix;
  index.set(index_key, new_entry);
  debug('Inserting new row', index_key);
  return new_entry;
}

function visitFileLocalesNamespace(lang_name, namespace_name, namespace_data, sheet_locales) {
  debug('Visiting', lang_name, namespace_name);
  for (const entry_key in namespace_data) {
    const sheet_key = namespace_name + '$$' + entry_key.trim();
    // 스프레드시트에 데이터 있는지 체크
    let sheet_entry = sheet_locales.index.get(sheet_key);
    if (sheet_entry == null) {
      // 빈 엔트리 생성
      const [, key, suffix] = /^((?:.|\r|\n)+?)(?:_([a-z]+))?$/.exec(entry_key);
      sheet_entry = appendSheetLocalesRow(sheet_locales, {
        namespace: namespace_name,
        key: key.trim(),
        suffix: suffix ?? '',
      });
    }
    const target_value = sheet_entry.values[lang_name];
    const target_finished = sheet_entry.finished[lang_name] === 'TRUE';
    if (target_value != null && target_value.trim() !== '' && target_finished) {
      // 업데이트된 데이터 반영
      namespace_data[entry_key] = target_value;
    }
    if (sheet_entry.is_new) {
      // 현재 언어 값 설정
      sheet_entry.values[lang_name] = namespace_data[entry_key];
      sheet_entry.finished[lang_name] = 'FALSE';
    }
    if (sheet_entry.used !== 'TRUE') {
      // 문서에 사용하지 않는다고 마킹된 경우 다시 마킹
      sheet_entry.used = 'TRUE';
      sheet_entry.has_changed = true;
    }
    sheet_entry.has_visited = true;
    sheet_entry.has_visited_per_lang[lang_name] = true;
  }
}

function visitFileLocalesLang(lang_name, lang_data, sheet_locales) {
  for (const namespace_name in lang_data) {
    const namespace_data = lang_data[namespace_name];
    visitFileLocalesNamespace(lang_name, namespace_name, namespace_data, sheet_locales);
  }
}

function visitFileLocales(file_locales, sheet_locales) {
  for (const lang_name in file_locales) {
    visitFileLocalesLang(lang_name, file_locales[lang_name], sheet_locales);
  }
}

function pruneSheetLocales(sheet_locales) {
  for (const entry of sheet_locales.entries) {
    if (!entry.has_visited) {
      entry.used = 'FALSE';
      entry.has_changed = true;
    }
  }
}

const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function getA1Notation(column, row) {
  let column_arr = [];
  let column_val = column - 1;
  do {
    column_arr.unshift(COLUMN_LETTERS[column_val % COLUMN_LETTERS.length]);
    column_val = Math.floor(column_val / COLUMN_LETTERS.length);
  } while (column_val > 0);
  return column_arr.join('') + row.toString(10);
}

const INSERT_PAGE_SIZE = 10000;

async function saveSheetLocales(sheets, spreadsheet_id, sheet_locales) {
  debug('Determining rows to update');
  const update_ranges = sheet_locales.entries
    .filter((entry) => entry.has_changed && !entry.is_new)
    .map((entry) => {
      const actual_row = entry.row + 2;
      return {
        range: `'문자열 목록'!${getA1Notation(1, actual_row)}:${getA1Notation(sheet_locales.columns.length, actual_row)}`,
        majorDimension: 'ROWS',
        values: [sheet_locales.columns.map((name, i) => {
          if (name === 'suffix') {
            return SUFFIX_MAPPING_TABLE_REV[entry.suffix];
          }
          if (name != null) {
            const value = _.get(entry, name) ?? '';
            if (/^[+=']/.test(value)) {
              return "'" + value;
            }
            return value;
          }
          return entry.raw_values[i] ?? '';
        })],
      };
    });
  if (update_ranges.length > 0) {
    debug('Updating', update_ranges.length, 'rows');
    for (let index = 0; index < update_ranges.length; index += INSERT_PAGE_SIZE) {
      debug('Updating', index, '...', index + INSERT_PAGE_SIZE);
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheet_id,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: update_ranges.slice(index, index + INSERT_PAGE_SIZE),
        },
      });
    }
  } else {
    debug('No rows to update');
  }
  debug('Determining rows to append');
  const append_values = sheet_locales.entries
    .filter((entry) => entry.has_changed && entry.is_new)
    .map((entry) => sheet_locales.columns.map((name, i) => {
      if (name === 'suffix') {
        return SUFFIX_MAPPING_TABLE_REV[entry.suffix];
      }
      if (name != null) {
        if (name === 'key' || name.startsWith('values')) {
          const value = _.get(entry, name) ?? '';
          if (/^[+=']/.test(value)) {
            return "'" + value;
          }
          return value;
        }
        return _.get(entry, name) ?? '';
      }
      return '';
    }));
  if (append_values.length > 0) {
    debug('Appending', append_values.length, 'rows');
    for (let index = 0; index < append_values.length; index += INSERT_PAGE_SIZE) {
      debug('Appending', index, '...', index + INSERT_PAGE_SIZE);
      await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheet_id,
        range: `'문자열 목록'`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: append_values.slice(index, index + INSERT_PAGE_SIZE),
        },
      });
    }
  } else {
    debug('No rows to append');
  }
}

async function saveFileLocales(locales_path, file_locales) {
  debug('Updating filesystem locales');
  for (const locale_name in file_locales) {
    const locale_data = file_locales[locale_name];
    for (const namespace_name in locale_data) {
      const namespace_data = locale_data[namespace_name];
      const file_path = path.resolve(locales_path, locale_name, namespace_name + '.json');
      const [, dir_path] = /^(.+)\/([^/]+)$/.exec(file_path);
      await mkdirp(dir_path);
      await fs.writeFile(file_path, JSON.stringify(namespace_data, null, 2) + '\n', 'utf-8');
    }
  }
}

const argv = yargs(process.argv.slice(2))
  .option('path', {
    alias: 'p',
    describe: 'locales 폴더 경로',
  })
  .demandOption(['path'])
  .help('h')
  .alias('h', 'help')
  .argv;

async function main() {
  const googleClient = await createGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth: googleClient });
  const file_locales = await loadFileLocales(argv.path);
  const sheet_locales = await loadSheetLocales(sheets, config.google.spreadsheetId);
  visitFileLocales(file_locales, sheet_locales);
  pruneSheetLocales(sheet_locales);
  await saveSheetLocales(sheets, config.google.spreadsheetId, sheet_locales);
  await saveFileLocales(argv.path, file_locales);
}

main();
