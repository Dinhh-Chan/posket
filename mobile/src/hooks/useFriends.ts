import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '../api/client';
import { errorMessage } from '../api/errors';
import type { FriendRequests, User } from '../api/types';
import { useOnForeground } from './useAppActive';

export interface FriendsState {
  friends: User[];
  requests: FriendRequests;
  loading: boolean;
  error: string | null;
  reload(): Promise<void>;
}

const EMPTY_REQUESTS: FriendRequests = { incoming: [], outgoing: [] };

export function useFriends(api: ApiClient): FriendsState {
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequests>(EMPTY_REQUESTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([api.friends(), api.friendRequests()]);
      setFriends(f);
      setRequests(r);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  useOnForeground(() => {
    reload().catch(() => {});
  });

  return { friends, requests, loading, error, reload };
}
