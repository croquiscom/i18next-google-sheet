import fs from 'fs/promises';
import path from 'path';
import debug from 'debug';
import mkdirp from 'mkdirp';
import { FileLocale } from './fileLocale.js';

const debugLog = debug('i18next-google-sheet:fileLocaleIO');

export async function loadFileLocale(locales_path: string): Promise<FileLocale> {
  async function scanDir(current_path: string, current_prefix: string[] = [], output: any = {}) {
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
        if (!file.name.endsWith('.json')) {
          // JSON이 아니므로 스킵
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
  const locale_files = await fs.readdir(locales_path, { withFileTypes: true });
  const locales: Record<string, any> = {};
  for (const file of locale_files) {
    if (!file.isDirectory()) continue;
    const file_path = path.resolve(locales_path, file.name);
    debugLog('Reading filesystem language', file.name);
    locales[file.name] = await scanDir(file_path);
  }
  return locales;
}

export async function saveFileLocale(
  locales_path: string,
  file_locale: FileLocale,
  escape_non_printable_unicode_characters?: boolean,
): Promise<void> {
  debugLog('Updating filesystem locales');
  for (const locale_name in file_locale) {
    const locale_data = file_locale[locale_name];
    for (const namespace_name in locale_data) {
      const namespace_data = locale_data[namespace_name];
      const file_path = path.resolve(locales_path, locale_name, namespace_name + '.json');
      const [, dir_path] = /^(.+)\/([^/]+)$/.exec(file_path)!;
      await mkdirp(dir_path);
      let output = JSON.stringify(namespace_data, null, 2) + '\n';
      if (escape_non_printable_unicode_characters) {
        // Convert non-printable Unicode characters to unicode escape sequence
        // https://unicode.org/reports/tr18/#General_Category_Property
        output = output.replace(/[\p{Z}\p{Cc}\p{Cf}]/gu, (chr) => {
          const n = chr.charCodeAt(0)
          return n < 128 ? chr : `\\u${`0000${n.toString(16)}`.substr(-4)}`
        });
      }
      await fs.writeFile(file_path, output, 'utf-8');
    }
  }
}
