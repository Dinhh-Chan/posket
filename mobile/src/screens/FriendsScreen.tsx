import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '../api/errors';
import type { FriendRequest, User } from '../api/types';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { Pill } from '../components/Pill';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextField } from '../components/TextField';
import { useFriends } from '../hooks/useFriends';
import type { ScreenProps } from '../navigation';
import { useSession } from '../state/SessionContext';
import { colors, radii, spacing } from '../theme';
import { normalizeUsername } from '../utils/validation';

type Relation = 'friend' | 'outgoing' | 'incoming' | 'none';

function UserRow({ user, right }: { user: User; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Avatar user={user} size={46} />
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {user.display_name}
        </Text>
        <Text style={styles.username} numberOfLines={1}>
          @{user.username}
        </Text>
      </View>
      {right}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function FriendsScreen({ navigation }: ScreenProps<'Friends'>) {
  const { api, user } = useSession();
  const { friends, requests, loading, error, reload } = useFriends(api);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Debounced username search.
  useEffect(() => {
    const q = normalizeUsername(query);
    if (q.length === 0) {
      setResults([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await api.searchUsers(q);
        if (!cancelled) {
          setResults(found);
          setSearchError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setSearchError(errorMessage(e));
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, api]);

  const relations = useMemo(() => {
    const map = new Map<number, Relation>();
    friends.forEach(f => map.set(f.id, 'friend'));
    requests.outgoing.forEach(r => map.set(r.to_user.id, 'outgoing'));
    requests.incoming.forEach(r => map.set(r.from_user.id, 'incoming'));
    return map;
  }, [friends, requests]);

  const run = async (
    key: string,
    action: () => Promise<unknown>,
    failTitle: string,
  ) => {
    setBusyId(key);
    try {
      await action();
      await reload();
    } catch (e) {
      Alert.alert(failTitle, errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const sendRequest = (target: User) =>
    run(
      `add-${target.id}`,
      async () => {
        const req = await api.sendFriendRequest(target.username);
        if (req.status === 'accepted') {
          Alert.alert(
            'Đã kết bạn',
            `Bạn và ${target.display_name} giờ là bạn bè.`,
          );
        }
      },
      'Không gửi được lời mời',
    );

  const accept = (req: FriendRequest) =>
    run(
      `req-${req.id}`,
      () => api.acceptFriendRequest(req.id),
      'Không chấp nhận được',
    );
  const decline = (req: FriendRequest) =>
    run(
      `req-${req.id}`,
      () => api.declineFriendRequest(req.id),
      'Không từ chối được',
    );

  const remove = (friend: User) => {
    Alert.alert(
      'Xoá bạn?',
      `Xoá ${friend.display_name} khỏi danh sách bạn bè?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            run(
              `rm-${friend.id}`,
              () => api.removeFriend(friend.id),
              'Không xoá được bạn',
            );
          },
        },
      ],
    );
  };

  const share = () => {
    if (!user) {
      return;
    }
    Share.share({
      message: `Kết bạn với mình trên PoseCam nhé! Tên người dùng: @${user.username}`,
    }).catch(() => {});
  };

  const renderAction = (target: User) => {
    const relation = relations.get(target.id) ?? 'none';
    if (relation === 'friend') {
      return <Text style={styles.status}>Bạn bè</Text>;
    }
    if (relation === 'outgoing') {
      return <Text style={styles.status}>Đã gửi</Text>;
    }
    const busy = busyId === `add-${target.id}`;
    return (
      <Pill
        small
        variant="accent"
        label={relation === 'incoming' ? 'Đồng ý' : 'Kết bạn'}
        onPress={() => sendRequest(target)}
        disabled={busy}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Bạn bè" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
            onRefresh={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
          />
        }
      >
        {user ? (
          <View style={styles.meCard}>
            <View style={styles.meText}>
              <Text style={styles.meLabel}>Tên người dùng của bạn</Text>
              <Text style={styles.meUsername}>@{user.username}</Text>
            </View>
            <Pill
              label="Chia sẻ"
              variant="accent"
              onPress={share}
              left={<Icon name="share" size={18} color="#000" />}
            />
          </View>
        ) : null}

        <TextField
          placeholder="Tìm theo tên người dùng…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {query.trim().length > 0 ? (
          <Section title="Kết quả tìm kiếm">
            {searching && results.length === 0 ? (
              <ActivityIndicator color={colors.accent} style={styles.pad} />
            ) : searchError ? (
              <Text style={styles.empty}>{searchError}</Text>
            ) : results.length === 0 ? (
              <Text style={styles.empty}>Không tìm thấy ai</Text>
            ) : (
              results.map(u => (
                <UserRow key={u.id} user={u} right={renderAction(u)} />
              ))
            )}
          </Section>
        ) : null}

        {requests.incoming.length > 0 ? (
          <Section title={`Lời mời kết bạn (${requests.incoming.length})`}>
            {requests.incoming.map(req => (
              <UserRow
                key={req.id}
                user={req.from_user}
                right={
                  <View style={styles.actions}>
                    <IconButton
                      icon="check"
                      onPress={() => accept(req)}
                      accessibilityLabel={`Chấp nhận ${req.from_user.display_name}`}
                      variant="accent"
                      size={40}
                      disabled={busyId === `req-${req.id}`}
                    />
                    <IconButton
                      icon="close"
                      onPress={() => decline(req)}
                      accessibilityLabel={`Từ chối ${req.from_user.display_name}`}
                      size={40}
                      disabled={busyId === `req-${req.id}`}
                    />
                  </View>
                }
              />
            ))}
          </Section>
        ) : null}

        {requests.outgoing.length > 0 ? (
          <Section title="Đã gửi lời mời">
            {requests.outgoing.map(req => (
              <UserRow
                key={req.id}
                user={req.to_user}
                right={<Text style={styles.status}>Đang chờ</Text>}
              />
            ))}
          </Section>
        ) : null}

        <Section title={`Bạn bè (${friends.length})`}>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={styles.pad} />
          ) : error && friends.length === 0 ? (
            <Text style={styles.empty}>{error}</Text>
          ) : friends.length === 0 ? (
            <Text style={styles.empty}>
              Chưa có bạn bè. Tìm tên người dùng ở trên để kết bạn.
            </Text>
          ) : (
            friends.map(f => (
              <UserRow
                key={f.id}
                user={f}
                right={
                  <Pill
                    small
                    variant="outline"
                    label="Xoá"
                    onPress={() => remove(f)}
                    disabled={busyId === `rm-${f.id}`}
                  />
                }
              />
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  meCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  meText: { flex: 1 },
  meLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  meUsername: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowText: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  username: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  status: { color: colors.textSecondary, fontSize: 14, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  empty: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    padding: spacing.lg,
  },
  pad: { padding: spacing.lg },
});
