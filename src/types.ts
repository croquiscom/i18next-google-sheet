export interface ProcessStatEntry {
  count: number;
  namespaces: Set<string>;
}

export interface ProcessStats {
  added: ProcessStatEntry;
  updated: ProcessStatEntry;
  reused: ProcessStatEntry;
  pruned: ProcessStatEntry;
}

export function createProcessStats(): ProcessStats {
  return {
    added: {
      count: 0,
      namespaces: new Set(),
    },
    updated: {
      count: 0,
      namespaces: new Set(),
    },
    reused: {
      count: 0,
      namespaces: new Set(),
    },
    pruned: {
      count: 0,
      namespaces: new Set(),
    },
  };
}
