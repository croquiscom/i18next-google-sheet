import fs from 'fs/promises';
import path from 'path';
import { debug } from 'debug';
import { FileLocale } from './fileLocale';

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
