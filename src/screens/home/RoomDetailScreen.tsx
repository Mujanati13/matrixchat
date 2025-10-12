import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useMatrix } from '@contexts/MatrixContext';
import type { AppStackParamList } from '@navigation/RootNavigator';
import type { MatrixTimelineEvent } from '@app-types/matrix';
import { extractDisplayName } from '@utils/matrixId';
import { resolveMxcToHttp } from '@services/matrixApi';
import { launchImageLibrary } from 'react-native-image-picker';

type Props = NativeStackScreenProps<AppStackParamList, 'RoomDetail'>;

const RoomDetailScreen = ({ route, navigation }: Props) => {
  const { roomId, roomName } = route.params;
  const { rooms, fetchMessages, sendMessage, sendImageMessage, deleteMessage, session, roomMessages, userProfile } = useMatrix();

  const currentUserId = session?.userId ?? '';

  const roomSummary = useMemo(
    () => rooms.find((room) => room.roomId === roomId),
    [roomId, rooms],
  );

  const cachedMessages = useMemo(
    () => roomMessages[roomId] ?? [],
    [roomMessages, roomId],
  );

  useLayoutEffect(() => {
    const displayName = roomSummary?.name ?? roomName ?? 'Conversation';
    const avatarMxc = roomSummary?.avatarUrl;
    const avatarUrl = session && avatarMxc ? resolveMxcToHttp(session, avatarMxc, 64, 64) : undefined;
    const firstLetter = displayName.charAt(0).toUpperCase();

    navigation.setOptions({
      title: displayName,
      headerRight: () => (
        <TouchableOpacity style={styles.headerProfile}>
          <View style={styles.profileAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.profileImage} />
            ) : (
              <Text style={styles.profileAvatarText}>{firstLetter}</Text>
            )}
          </View>
        </TouchableOpacity>
      ),
    });
  }, [navigation, roomSummary?.name, roomSummary?.avatarUrl, roomName, session]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const lastLoadedEventRef = useRef<string | null>(null);

  // Use cached messages from context as the primary source
  const messages = useMemo(() => {
    return cachedMessages.length > 0 ? cachedMessages : [];
  }, [cachedMessages]);

  useEffect(() => {
    if (cachedMessages.length > 0) {
      const latestEvent = cachedMessages[cachedMessages.length - 1];
      lastLoadedEventRef.current = latestEvent?.eventId ?? null;
      setLoading(false);
    }
  }, [cachedMessages]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMessages(roomId);
      // Messages will be updated through the context's roomMessages cache
      const latestEvent = data.length > 0 ? data[data.length - 1] : undefined;
      lastLoadedEventRef.current = latestEvent?.eventId ?? null;
    } catch (error: any) {
      Alert.alert('Unable to load messages', error?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchMessages, roomId]);

  // Only load messages once when the component mounts or roomId changes
  useEffect(() => {
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMessages();
    } finally {
      setRefreshing(false);
    }
  }, [loadMessages]);

  const handleSend = useCallback(async () => {
    const body = input.trim();
    if (!body || sending) {
      return;
    }

    setSending(true);
    try {
      await sendMessage(roomId, body);
      setInput('');
    } catch (error: any) {
      Alert.alert('Unable to send', error?.message ?? 'Try again later.');
    } finally {
      setSending(false);
    }
  }, [input, roomId, sendMessage, sending]);

  const handleSendImage = useCallback(async () => {
    if (sending) {
      return;
    }

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        Alert.alert('Error', 'Could not get image');
        return;
      }

      setSending(true);
      await sendImageMessage(
        roomId,
        asset.uri,
        asset.type || 'image/jpeg',
        asset.fileName || `image_${Date.now()}.jpg`,
      );
    } catch (error: any) {
      Alert.alert('Unable to send image', error?.message ?? 'Try again later.');
    } finally {
      setSending(false);
    }
  }, [roomId, sendImageMessage, sending]);

  const handleRetrySend = useCallback(
    async (event: MatrixTimelineEvent) => {
      if (sending) {
        return;
      }
      const retryBody = (event.decryptedBody ?? event.body ?? '').trim();
      if (!retryBody || !event.transactionId) {
        Alert.alert('Cannot resend', 'This message cannot be resent automatically.');
        return;
      }

      setSending(true);
      try {
        await sendMessage(roomId, retryBody, event.transactionId);
      } catch (error: any) {
        Alert.alert('Unable to resend', error?.message ?? 'Try again later.');
      } finally {
        setSending(false);
      }
    },
    [roomId, sendMessage, sending],
  );

  const handleDeleteMessage = useCallback(
    async (event: MatrixTimelineEvent) => {
      const isOwnMessage = event.senderId === currentUserId;
      
      if (!isOwnMessage) {
        Alert.alert('Error', 'You can only delete your own messages');
        return;
      }

      Alert.alert(
        'Delete Message',
        'Are you sure you want to delete this message?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteMessage(roomId, event.eventId);
              } catch (error: any) {
                Alert.alert('Error', error?.message ?? 'Failed to delete message');
              }
            },
          },
        ]
      );
    },
    [currentUserId, deleteMessage, roomId],
  );

  const renderMessage = useCallback(
    ({ item }: { item: MatrixTimelineEvent }) => {
      const isOwnMessage = item.senderId === currentUserId;
      const displayName = isOwnMessage ? 'You' : (item.senderName ?? extractDisplayName(item.senderId));
      const textToDisplay = item.decryptedBody ?? item.body;
      const messageContent = textToDisplay || (item.isEncrypted ? 'Encrypted message (not yet decrypted)' : 'Unsupported event');
      
      // Check if this is an image message
      const isImage = item.content?.msgtype === 'm.image';
      const imageUrl = isImage && item.content?.url && session 
        ? resolveMxcToHttp(session, item.content.url as string, 400, 400)
        : null;
      
      const bubbleStyles: ViewStyle[] = [];
      bubbleStyles.push(styles.messageBubble);
      bubbleStyles.push(isOwnMessage ? styles.messageBubbleOwn : styles.messageBubbleOther);

      let statusLabel: string | null = null;
      const statusStyles: TextStyle[] = [styles.messageStatus];

      if (isOwnMessage) {
        if (item.status === 'pending') {
          bubbleStyles.push(styles.messageBubblePending);
          statusLabel = 'Sending…';
          statusStyles.push(styles.messageStatusPending);
        } else if (item.status === 'error') {
          bubbleStyles.push(styles.messageBubbleError);
          statusLabel = 'Failed to send – tap to retry';
          statusStyles.push(styles.messageStatusError);
        }
      }

      const metadata = (
        <View style={styles.messageMeta}>
          <Text style={styles.messageTimestamp}>{formatTimestamp(item.timestamp)}</Text>
          {statusLabel ? <Text style={statusStyles}>{statusLabel}</Text> : null}
        </View>
      );

      const bubbleContent = (
        <>
          {isImage && imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.messageImage} resizeMode="cover" />
          ) : null}
          {messageContent ? <Text style={styles.messageBody}>{messageContent}</Text> : null}
          {metadata}
        </>
      );

      const containerStyles = [styles.messageRow, isOwnMessage ? styles.messageRowOwn : undefined];

      if (isOwnMessage && item.status === 'error') {
        return (
          <View style={containerStyles}>
            {!isOwnMessage ? <Text style={styles.messageSender}>{displayName}</Text> : null}
            <TouchableOpacity
              style={bubbleStyles}
              activeOpacity={0.7}
              onPress={() => handleRetrySend(item)}
            >
              {bubbleContent}
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={containerStyles}>
          {!isOwnMessage ? <Text style={styles.messageSender}>{displayName}</Text> : null}
          <TouchableOpacity
            style={bubbleStyles}
            activeOpacity={0.7}
            onLongPress={() => handleDeleteMessage(item)}
          >
            {bubbleContent}
          </TouchableOpacity>
        </View>
      );
    },
    [currentUserId, handleRetrySend, handleDeleteMessage],
  );

  const keyExtractor = useCallback(
    (item: MatrixTimelineEvent) => `${item.eventId}-${item.timestamp}`,
    [],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.safeArea}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {loading && messages.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4f9dff" />
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={keyExtractor}
              renderItem={renderMessage}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#4f9dff"
                  colors={['#4f9dff']}
                />
              }
            />
          )}

          <View style={styles.composerContainer}>
            <TouchableOpacity
              style={[styles.imageButton, sending && styles.imageButtonDisabled]}
              onPress={handleSendImage}
              disabled={sending}
            >
              <Text style={styles.imageButtonText}>📷</Text>
            </TouchableOpacity>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Write a message"
              placeholderTextColor="#6c6c6c"
              style={styles.composerInput}
              multiline
              maxLength={4000}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
            >
              <Text style={styles.sendButtonText}>{sending ? '...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050b12',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageRow: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  messageRowOwn: {
    alignItems: 'flex-end',
  },
  messageSender: {
    color: '#6e7b92',
    fontSize: 12,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  messageBubbleOwn: {
    backgroundColor: '#0b5cff',
  },
  messageBubbleOther: {
    backgroundColor: '#101723',
  },
  messageBubblePending: {
    opacity: 0.7,
  },
  messageBubbleError: {
    backgroundColor: '#7a1b1b',
  },
  messageBody: {
    color: '#ffffff',
    fontSize: 15,
  },
  messageImage: {
    width: 250,
    height: 250,
    borderRadius: 12,
    marginBottom: 6,
  },
  messageMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'baseline',
    marginTop: 6,
  },
  messageTimestamp: {
    color: '#8a94a8',
    fontSize: 11,
    textAlign: 'right',
  },
  messageStatus: {
    color: '#cbd4ff',
    fontSize: 11,
    marginLeft: 12,
  },
  messageStatusPending: {
    color: '#dee6ff',
  },
  messageStatusError: {
    color: '#ff8a80',
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#101723',
    backgroundColor: '#070d16',
  },
  imageButton: {
    marginRight: 12,
    backgroundColor: '#101723',
    borderRadius: 999,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageButtonDisabled: {
    opacity: 0.5,
  },
  imageButtonText: {
    fontSize: 20,
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#101723',
    color: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    maxHeight: 120,
  },
  sendButton: {
    marginLeft: 12,
    backgroundColor: '#0b5cff',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#1f3d7a',
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  headerProfile: {
    marginRight: 8,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0b5cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});

export default RoomDetailScreen;
