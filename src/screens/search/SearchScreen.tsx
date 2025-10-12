import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useMatrix } from '@contexts/MatrixContext';
import type { AppStackParamList } from '@navigation/RootNavigator';
import { extractDisplayName } from '@utils/matrixId';

type Props = NativeStackScreenProps<AppStackParamList, 'Search'>;

type UserResult = {
  userId: string;
  displayName?: string;
};

const SearchScreen = ({ navigation }: Props) => {
  const { searchUsers, createDirectRoom, joinRoom, rooms, refreshRooms } = useMatrix();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [creatingRoomId, setCreatingRoomId] = useState<string | null>(null);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    let cancelled = false;

    const runSearch = async () => {
      if (trimmedQuery.length < 3) {
        setResults([]);
        setLoading(false);
        setErrorMessage(null);
        return;
      }

      setLoading(true);
      setErrorMessage(null);
      try {
        const users = await searchUsers(trimmedQuery);
        if (!cancelled) {
          setResults(users);
        }
      } catch (error: any) {
        if (!cancelled) {
          const message = error?.message ?? 'Could not search right now.';
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timeout = setTimeout(runSearch, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchUsers, trimmedQuery]);

  const existingDirectRoomId = useCallback(
    (userId: string) =>
      rooms.find((room) => room.membership === 'join' && room.isDirect && room.name === userId)?.roomId ?? null,
    [rooms],
  );

  const handleCreateDirect = useCallback(
    async (user: UserResult) => {
      if (creatingRoomId) {
        return;
      }

      const currentRoomId = existingDirectRoomId(user.userId);
      const displayName = user.displayName ?? extractDisplayName(user.userId);
      if (currentRoomId) {
        navigation.navigate('RoomDetail', { roomId: currentRoomId, roomName: displayName });
        return;
      }

      setCreatingRoomId(user.userId);
      try {
        const roomId = await createDirectRoom(user.userId);
        await refreshRooms();
        navigation.navigate('RoomDetail', {
          roomId,
          roomName: displayName,
        });
      } catch (error: any) {
        const message = error?.response?.data?.error ?? error?.message ?? 'Could not start chat.';
        Alert.alert('Start chat failed', String(message));
      } finally {
        setCreatingRoomId(null);
      }
    },
    [createDirectRoom, creatingRoomId, existingDirectRoomId, navigation, refreshRooms],
  );

  const handleJoinRoom = useCallback(async () => {
    const target = joinInput.trim();
    if (!target) {
      return;
    }

    setJoining(true);
    try {
      const joinedRoomId = await joinRoom(target);
      await refreshRooms();
      if (joinedRoomId) {
        navigation.navigate('RoomDetail', { roomId: joinedRoomId, roomName: target });
        setJoinInput('');
      }
    } catch (error: any) {
      const message = error?.response?.data?.error ?? error?.message ?? 'Could not join room.';
      Alert.alert('Join room failed', String(message));
    } finally {
      setJoining(false);
    }
  }, [joinInput, joinRoom, navigation, refreshRooms]);

  const renderResult = useCallback(
    ({ item }: { item: UserResult }) => {
      const isBusy = creatingRoomId === item.userId;
      const existingRoomId = existingDirectRoomId(item.userId);
      const displayName = item.displayName ?? extractDisplayName(item.userId);
      const username = extractDisplayName(item.userId);
      return (
        <TouchableOpacity style={styles.resultRow} onPress={() => handleCreateDirect(item)} disabled={isBusy}>
          <View>
            <Text style={styles.resultName}>{displayName}</Text>
            {item.displayName ? <Text style={styles.resultId}>@{username}</Text> : null}
          </View>
          <Text style={styles.resultAction}>{isBusy ? 'Opening…' : existingRoomId ? 'Open chat' : 'Start chat'}</Text>
        </TouchableOpacity>
      );
    },
    [creatingRoomId, existingDirectRoomId, handleCreateDirect],
  );

  const renderEmpty = useCallback(() => {
    if (trimmedQuery.length < 3 || loading) {
      return null;
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyState}>No users found</Text>
      </View>
    );
  }, [loading, trimmedQuery]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.userId}
        renderItem={renderResult}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Find people & rooms</Text>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Search users</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Type at least 3 characters"
                placeholderTextColor="#6c6c6c"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {loading ? <ActivityIndicator style={styles.spinner} color="#4f9dff" /> : null}
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            </View>
          </View>
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Join room by ID or alias</Text>
              <TextInput
                value={joinInput}
                onChangeText={setJoinInput}
                placeholder="#room:server"
                placeholderTextColor="#6c6c6c"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.primaryButton, (!joinInput.trim() || joining) && styles.primaryButtonDisabled]}
                onPress={handleJoinRoom}
                disabled={!joinInput.trim() || joining}
              >
                <Text style={styles.primaryButtonText}>{joining ? 'Joining…' : 'Join room'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.resultSeparator} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#04070d',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    paddingTop: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    color: '#8a909f',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#10141d',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#1c2331',
  },
  spinner: {
    marginTop: 12,
  },
  errorText: {
    marginTop: 12,
    color: '#ff8080',
  },
  emptyContainer: {
    paddingVertical: 24,
  },
  emptyState: {
    color: '#566078',
    textAlign: 'center',
    paddingVertical: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  resultSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1c2331',
  },
  resultName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultId: {
    color: '#6e7b92',
    marginTop: 4,
  },
  resultAction: {
    color: '#4f9dff',
    fontWeight: '600',
  },
  footer: {
    paddingTop: 16,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#0b5cff',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#1f3d7a',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SearchScreen;
