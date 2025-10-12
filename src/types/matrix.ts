export type MatrixSession = {
  accessToken: string;
  userId: string;
  deviceId: string;
  homeserver: string;
  nextSyncToken?: string | null;
};

export type MatrixRoomSummary = {
  roomId: string;
  membership: 'join' | 'invite';
  name: string;
  topic?: string;
  avatarUrl?: string;
  isDirect: boolean;
  notificationCount: number;
  highlightCount: number;
  lastEvent?: {
    eventId: string;
    senderId: string;
    senderName?: string;
    type: string;
    body?: string;
    timestamp: number;
  };
  timeline?: MatrixTimelineEvent[];
  inviterId?: string;
};

export type MatrixTimelineEvent = {
  eventId: string;
  roomId: string;
  senderId: string;
  senderName?: string;
  type: string;
  timestamp: number;
  body?: string;
  isEncrypted: boolean;
  decryptedBody?: string;
  content?: Record<string, unknown>;
  status?: 'pending' | 'sent' | 'error';
  transactionId?: string;
};

