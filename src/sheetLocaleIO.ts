import debug from 'debug';
import { sheets_v4 } from 'googleapis';
import { COLUMN_MAP, SUFFIX_MAP } from './mapping.js';
import { SheetEntry, SheetEntryValues } from './sheetEntry.js';
import { SheetLocale } from './sheetLocale.js';

const debugLog = debug('i18next-google-sheet:sheetLocaleIO');

export type SheetColumns = Array<string | null>;

export interface SheetLocaleIOResult {
  locale: SheetLocale;
  columns: SheetColumns;
}

function getSpreadsheetColumns(heading_row: string[]) {
  return heading_row.map((row_name) => COLUMN_MAP[row_name] ?? row_name);
}

export async function loadSheetLocale(
  sheets: sheets_v4.Sheets,
  spreadsheet_id: string,
  range: string,
): Promise<SheetLocaleIOResult> {
  debugLog('Reading spreadsheet', spreadsheet_id);
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: spreadsheet_id,
    ranges: [range],
  });
  const rows = res.data.valueRanges![0].values!;
  // 첫번째 행에서 컬럼 정보 추출
  const columns = getSpreadsheetColumns(rows[0]);
  // 두번째 행부터 실제 데이터 추출
  const entries = rows.slice(1).map((row, i) => {
    const values: Record<string, string> = {};
    columns.forEach((key, j) => {
      values[key] = row[j];
    });
    if (!values.namespace || !values.key) {
      // 빈 값은 무시
      return null;
    }
    const entry: SheetEntry = {
      row_id: i,
      namespace: values.namespace,
      key: values.key,
      suffix: SUFFIX_MAP[values.suffix] ?? null,
      values: values as Record<string, string> & SheetEntryValues,
      has_changed: false,
      has_visited: false,
      raw_values: row,
    };
    return entry;
  }).filter((v): v is SheetEntry => v != null);
  debugLog('Read', entries.length, 'items');

  const locale = new SheetLocale();
  locale.insertAll(entries);

  return { columns, locale };
}


const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function toA1Notation(column: number, row: number) {
  const column_arr = [];
  let column_val = column - 1;
  do {
    column_arr.unshift(COLUMN_LETTERS[column_val % COLUMN_LETTERS.length]);
    column_val = Math.floor(column_val / COLUMN_LETTERS.length);
  } while (column_val > 0);
  return column_arr.join('') + row.toString(10);
}

function fromA1Notation(input: string): { column: number | null, row: number | null } {
  const match = /^([A-Z]+)?([0-9]+)?$/.exec(input.toUpperCase());
  if (match == null) throw new Error(`${input} is not parsable notation`);
  const [, column_str, row_str] = match;
  let column: number | null = null;
  if (column_str) {
    column = column_str.split('').reduce((prev, letter) => {
      return prev * COLUMN_LETTERS.length + (letter.charCodeAt(0) - 'A'.charCodeAt(0));
    }, 0) + 1;
  }
  let row: number | null = null;
  if (row_str) {
    row = parseInt(row_str);
  }
  return { column, row };
}

function getRangeMin(range: string): { namespace: string, row: number, column: number } {
  const match = /^('(?:[^']|'')+'|[^! ']+)?(?:!([A-Z]+|[0-9]+|[A-Z]+[0-9]+)(?::([A-Z]+|[0-9]+|[A-Z]+[0-9]+))?)?$/.exec(range);
  if (match == null) throw new Error(`${range} is not parsable range`);
  const [, namespace, min] = match;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const min_addr = fromA1Notation(min ?? '');
  return {
    namespace,
    row: min_addr.row ?? 1,
    column: min_addr.column ?? 1,
  };
}

const INSERT_PAGE_SIZE = 10000;

export async function saveSheetLocale(
  sheets: sheets_v4.Sheets,
  spreadsheet_id: string,
  range: string,
  columns: SheetColumns,
  sheet_locale: SheetLocale,
) {
  debugLog('Determining rows to update');
  const range_min = getRangeMin(range);
  const update_ranges = sheet_locale.entries
    .filter((entry) => entry.has_changed && entry.row_id != null)
    .map((entry) => {
      const actual_row = entry.row_id! + 1;
      return {
        range: range_min.namespace + '!' + 
          toA1Notation(range_min.column, range_min.row + actual_row) + ':' +
          toA1Notation(range_min.column + columns.length - 1, range_min.row + actual_row),
        majorDimension: 'ROWS',
        values: [columns.map((key, i) => {
          if (key != null) {
            const value = entry.values[key] ?? '';
            if (/^[+=']/.test(value)) {
              return "'" + value;
            }
            return value;
          }
          return entry.raw_values![i] ?? '';
        })],
      };
    });
  if (update_ranges.length > 0) {
    debugLog('Updating', update_ranges.length, 'rows');
    for (let index = 0; index < update_ranges.length; index += INSERT_PAGE_SIZE) {
      debugLog('Updating', index, '...', index + INSERT_PAGE_SIZE);
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheet_id,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: update_ranges.slice(index, index + INSERT_PAGE_SIZE),
        },
      }, {});
    }
  } else {
    debugLog('No rows to update');
  }
  debugLog('Determining rows to append');
  const append_values = sheet_locale.entries
    .filter((entry) => entry.has_changed && entry.row_id == null)
    .map((entry) => columns.map((key, i) => {
      if (key != null) {
        const value = entry.values[key] ?? '';
        if (/^[+=']/.test(value)) {
          return "'" + value;
        }
        return value;
      }
      return entry.raw_values![i] ?? '';
    }));
  if (append_values.length > 0) {
    debugLog('Appending', append_values.length, 'rows');
    for (let index = 0; index < append_values.length; index += INSERT_PAGE_SIZE) {
      debugLog('Appending', index, '...', index + INSERT_PAGE_SIZE);
      await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheet_id,
        range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: append_values.slice(index, index + INSERT_PAGE_SIZE),
        },
      }, {});
    }
  } else {
    debugLog('No rows to append');
  }
}
