import type { FactoryState, StoreEvent } from './store.js';

export type Sender = (data: string) => void;

export interface Broadcaster {
  add(sender: Sender): void;
  remove(sender: Sender): void;
  publish(event: StoreEvent, state: FactoryState): void;
  connectionCount(): number;
}

export function createBroadcaster(): Broadcaster {
  const senders = new Set<Sender>();

  return {
    add(sender) {
      senders.add(sender);
    },
    remove(sender) {
      senders.delete(sender);
    },
    publish(event, state) {
      const message = JSON.stringify({
        event,
        snapshot: {
          projects: state.projects.length,
          jobs: state.jobs.length,
          events: state.events.length,
        },
      });
      for (const sender of senders) {
        try {
          sender(message);
        } catch {
          senders.delete(sender);
        }
      }
    },
    connectionCount() {
      return senders.size;
    },
  };
}
