import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { FactoryState } from './store.js';
import { defaultState } from './store.js';

export interface Persistence {
  load(): Promise<FactoryState>;
  scheduleSave(): void;
  flush(): Promise<void>;
}

export function createPersistence(filePath: string, getState: () => FactoryState, debounceMs = 100): Persistence {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> = Promise.resolve();

  async function save(): Promise<void> {
    const snapshot = getState();
    const serialized = JSON.stringify(snapshot, null, 2);
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await writeFile(tmp, serialized, 'utf8');
    await rename(tmp, filePath);
  }

  return {
    async load(): Promise<FactoryState> {
      try {
        const raw = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<FactoryState>;
        const base = defaultState();
        return {
          projects: parsed.projects ?? base.projects,
          events: parsed.events ?? base.events,
          jobs: parsed.jobs ?? base.jobs,
          gates: parsed.gates ?? base.gates,
          artifacts: parsed.artifacts ?? base.artifacts,
          releases: parsed.releases ?? base.releases,
          settings: parsed.settings ?? base.settings,
        };
      } catch {
        return defaultState();
      }
    },

    scheduleSave(): void {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        writing = writing.then(save).catch(() => undefined);
      }, debounceMs);
    },

    async flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await writing;
      await save();
    },
  };
}
