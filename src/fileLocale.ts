export interface FileLocaleNamespace {
  [key: string]: string;
}

export interface FileLocaleLang {
  [namespace: string]: FileLocaleNamespace;
}

export interface FileLocale {
  [lang_code: string]: FileLocaleLang;
}
