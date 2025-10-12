import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useMatrix } from '@contexts/MatrixContext';
import type { AppStackParamList } from '@navigation/RootNavigator';

type Props = NativeStackScreenProps<AppStackParamList, 'Rooms'>;

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) {
    return 'No activity yet';
  }
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  const date = new Date(timestamp);
  return date.toLocaleDateString();
};

const RoomListScreen = ({ navigation }: Props) => {
  const { rooms, roomsLoading, refreshRooms, leaveRoom } = useMatrix();
  const [refreshing, setRefreshing] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  const joinedRooms = useMemo(
    () => rooms.filter((room) => room.membership === 'join'),
    [rooms],
  );

  const sortedRooms = useMemo(() => {
    return [...joinedRooms].sort((a, b) => {
      const aTime = a.lastEvent?.timestamp ?? 0;
      const bTime = b.lastEvent?.timestamp ?? 0;
      return bTime - aTime;
    });
  }, [joinedRooms]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshRooms();
    } finally {
      setRefreshing(false);
    }
  }, [refreshRooms]);

  const handleDeleteConversation = useCallback(async (roomId: string, roomName: string) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to leave and delete "${roomName}"? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingRoomId(roomId);
            try {
              await leaveRoom(roomId);
              await refreshRooms();
            } catch (error: any) {
              Alert.alert('Error', error?.message ?? 'Failed to delete conversation');
            } finally {
              setDeletingRoomId(null);
            }
          },
        },
      ]
    );
  }, [leaveRoom, refreshRooms]);

  const emptyState = (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        Start a new chat by searching for people or joining a Matrix room.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('Search')}
      >
        <Text style={styles.primaryButtonText}>Find people & rooms</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rooms</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Search')}>
          <Text style={styles.secondaryButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {roomsLoading && sortedRooms.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f9dff" />
        </View>
      ) : (
        <FlatList
          data={sortedRooms}
          keyExtractor={(item) => item.roomId}
          renderItem={({ item }) => {
            const isDeleting = deletingRoomId === item.roomId;
            return (
              <TouchableOpacity
                style={[styles.roomCard, isDeleting && styles.roomCardDeleting]}
                onPress={() => navigation.navigate('RoomDetail', { roomId: item.roomId, roomName: item.name })}
                onLongPress={() => handleDeleteConversation(item.roomId, item.name)}
                disabled={isDeleting}
                activeOpacity={0.7}
              >
                <View style={styles.roomHeader}>
                  <Text style={styles.roomName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.roomTimestamp}>{formatTimestamp(item.lastEvent?.timestamp)}</Text>
                </View>
                {item.lastEvent?.body ? (
                  <Text style={styles.roomPreview} numberOfLines={1}>
                    {item.lastEvent.body}
                  </Text>
                ) : (
                  <Text style={styles.roomPreviewPlaceholder}>No messages yet</Text>
                )}
                {item.notificationCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.notificationCount}</Text>
                  </View>
                ) : null}
                {isDeleting ? (
                  <View style={styles.deletingOverlay}>
                    <ActivityIndicator size="small" color="#ff4444" />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={emptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#4f9dff"
              colors={['#4f9dff']}
            />
          }
          contentContainerStyle={sortedRooms.length === 0 ? styles.emptyListContainer : undefined}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04070d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#101723',
  },
  secondaryButtonText: {
    color: '#4f9dff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCard: {
    marginHorizontal: 24,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#0c1421',
    borderRadius: 16,
    position: 'relative',
  },
  roomCardDeleting: {
    opacity: 0.5,
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roomName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  roomTimestamp: {
    color: '#5f6b80',
    fontSize: 12,
  },
  roomPreview: {
    color: '#a8b0c3',
    fontSize: 14,
  },
  roomPreviewPlaceholder: {
    color: '#566078',
    fontSize: 14,
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 18,
    backgroundColor: '#0b5cff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  separator: {
    height: 16,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#0c1421',
    padding: 24,
    borderRadius: 18,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8a94a8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#0b5cff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RoomListScreen;
