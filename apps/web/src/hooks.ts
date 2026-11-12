import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, error, loading, reload };
}

export interface LiveEvent {
  type: string;
  payload: unknown;
  receivedAt: string;
}

export function useLiveEvents(): { connected: boolean; lastEvent: LiveEvent | null } {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socket.onopen = () => {
        if (!closed) setConnected(true);
      };
      socket.onmessage = (message) => {
        try {
          const parsed = JSON.parse(String(message.data)) as {
            event?: { type?: string; payload?: unknown };
          };
          if (parsed.event?.type) {
            setLastEvent({
              type: parsed.event.type,
              payload: parsed.event.payload,
              receivedAt: new Date().toISOString(),
            });
          }
        } catch {
          setLastEvent({
            type: 'unparsed',
            payload: String(message.data),
            receivedAt: new Date().toISOString(),
          });
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!closed) {
          retryTimer = setTimeout(() => setAttempt((a) => a + 1), 3000);
        }
      };
      socket.onerror = () => {
        setConnected(false);
      };
    };

    connect();
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [attempt]);

  return { connected, lastEvent };
}
