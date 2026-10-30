import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Photo } from '../api/types';
import { FEED_REFRESH_MS } from '../config';
import { widget } from '../native';
import { useAppActive, useOnForeground } from './useAppActive';

/** New first page on top, then the already-loaded older photos (deduplicated). */
export function mergeFeed(fresh: Photo[], existing: Photo[]): Photo[] {
  if (fresh.length === 0) {
    return existing;
  }
  const oldest = fresh[fresh.length - 1].id;
  const seen = new Set(fresh.map(p => p.id));
  return [...fresh, ...existing.filter(p => p.id < oldest && !seen.has(p.id))];
}

export interface FeedState {
  items: Photo[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  /** Reloads the first page; `showSpinner` for pull-to-refresh. */
  refresh(showSpinner?: boolean): Promise<void>;
  loadMore(): Promise<void>;
  /** Replace one photo (e.g. after a reaction). */
  replacePhoto(photo: Photo): void;
  removePhoto(id: number): void;
}

export function useFeed(api: ApiClient, visible: boolean): FeedState {
  const [items, setItems] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const initialized = useRef(false);
  const busy = useRef(false);
  const appActive = useAppActive();

  const refresh = useCallback(
    async (showSpinner = false) => {
      if (busy.current) {
        return;
      }
      busy.current = true;
      if (showSpinner) {
        setRefreshing(true);
      }
      try {
        const page = await api.feed({ limit: 30 });
        setItems(prev => mergeFeed(page.items, prev));
        if (!initialized.current) {
          setNextBeforeId(page.next_before_id);
          initialized.current = true;
        }
        setError(null);
        widget.refresh();
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        busy.current = false;
        setRefreshing(false);
        setLoading(false);
      }
    },
    [api],
  );

  const loadMore = useCallback(async () => {
    if (busy.current || nextBeforeId === null) {
      return;
    }
    busy.current = true;
    setLoadingMore(true);
    try {
      const page = await api.feed({ beforeId: nextBeforeId, limit: 30 });
      setItems(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...page.items.filter(p => !seen.has(p.id))];
      });
      setNextBeforeId(page.next_before_id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [api, nextBeforeId]);

  // First load.
  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // Periodic refresh while the history is visible and the app in the foreground.
  useEffect(() => {
    if (!visible || !appActive) {
      return;
    }
    refresh().catch(() => {});
    const id = setInterval(() => {
      refresh().catch(() => {});
    }, FEED_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, appActive]);

  useOnForeground(() => {
    refresh().catch(() => {});
  });

  const replacePhoto = useCallback((photo: Photo) => {
    setItems(prev => prev.map(p => (p.id === photo.id ? photo : p)));
  }, []);

  const removePhoto = useCallback((id: number) => {
    setItems(prev => prev.filter(p => p.id !== id));
  }, []);

  return {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: nextBeforeId !== null,
    refresh,
    loadMore,
    replacePhoto,
    removePhoto,
  };
}
