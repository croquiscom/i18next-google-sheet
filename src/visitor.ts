import dayjs from 'dayjs';
import { debug } from 'debug';
import { FileLocale, FileLocaleLang, FileLocaleNamespace } from './fileLocale';
import { SUFFIX_MAP_REV } from './mapping';
import { SheetLocale } from './sheetLocale';

const debugLog = debug('i18next-google-sheet:visitor');

export function visitLocaleNamespace(
  lang_name: string,
  namespace_name: string,
  namespace_data: FileLocaleNamespace,
  sheet_locale: SheetLocale,
) {
  for (const entry_key in namespace_data) {
    const [, key, suffix] = /^((?:.|\r|\n)+?)(?:_([a-z]+))?$/.exec(entry_key)!;
    // 스프레드시트에 데이터 있는지 체크
    let sheet_entry = sheet_locale.get({ namespace: namespace_name, key, suffix });
    if (sheet_entry == null) {
      // 빈 엔트리 생성
      sheet_entry = {
        row_id: null,
        namespace: namespace_name,
        key,
        suffix,
        values: {
          namespace: namespace_name,
          key,
          suffix: SUFFIX_MAP_REV[suffix],
          used: 'TRUE',
          created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        },
        has_changed: true,
        has_visited: true,
        raw_values: null,
      };
      sheet_locale.insert(sheet_entry);
      debugLog('Creating new entry', key);
      console.log('Creating new entry', sheet_locale.getIndexKey(sheet_entry));
    }
    const target_value = sheet_entry.values[lang_name];
    if (target_value != null && target_value.trim() !== '') {
      // 업데이트된 데이터 반영
      if (namespace_data[entry_key] !== target_value) {
        console.log('Updating record', lang_name, sheet_locale.getIndexKey(sheet_entry));
        namespace_data[entry_key] = target_value;
      }
    }
    if (target_value == null) {
      // 현재 언어 값 설정
      sheet_entry.values[lang_name] = namespace_data[entry_key];
      sheet_entry.has_changed = true;
    }
    if (sheet_entry.values.used !== 'TRUE') {
      // 문서에 사용하지 않는다고 마킹된 경우 다시 마킹
      sheet_entry.values.used = 'TRUE';
      sheet_entry.has_changed = true;
      console.log('Remarking entry', sheet_locale.getIndexKey(sheet_entry));
    }
    sheet_entry.has_visited = true;
  }
}

function visitLocaleLang(lang_name: string, lang_data: FileLocaleLang, sheet_locale: SheetLocale) {
  for (const namespace_name in lang_data) {
    const namespace_data = lang_data[namespace_name];
    visitLocaleNamespace(lang_name, namespace_name, namespace_data, sheet_locale);
  }
}

export function visitLocale(file_locale: FileLocale, sheet_locale: SheetLocale) {
  for (const lang_name in file_locale) {
    visitLocaleLang(lang_name, file_locale[lang_name], sheet_locale);
  }
}
