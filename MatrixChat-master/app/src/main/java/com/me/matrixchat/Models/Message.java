package com.me.matrixchat.Models;

import androidx.annotation.Nullable;

import com.me.matrixchat.data.TimelineEventSenderWrapper;
import com.stfalcon.chatkit.commons.models.IMessage;
import com.stfalcon.chatkit.commons.models.IUser;
import com.stfalcon.chatkit.commons.models.MessageContentType;
import com.stfalcon.chatkit.commons.models.MessageContentType.Image;

import org.matrix.android.sdk.api.session.room.timeline.TimelineEvent;

import java.util.Date;

public class Message implements IMessage, Image {
    private String messageId;
    private String senderId;  // Matrix ID of sender
    private String roomId;
    private String text;   // Text message
    private String timestamp;
    private boolean isEncrypted;
    private transient TimelineEvent event; // 🔥 This prevents serialization

    private String imageUrl;

    // Constructors, Getters, and Setters

    public Message() {
    }

    public Message(TimelineEvent evt, String messageId, String senderId, String roomId, String text, String url, String timestamp, boolean isEncrypted) {
        event = evt;
        this.messageId = messageId;
        this.senderId = senderId;
        this.roomId = roomId;
        this.text = text;
        this.timestamp = timestamp;
        this.isEncrypted = isEncrypted;
        this.imageUrl = url;
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public String getSenderId() {
        return senderId;
    }

    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    @Override
    public String getId() {
        return getMessageId();
    }

    public String getText() {
        return text;
    }

    @Override
    public IUser getUser() {
        return new TimelineEventSenderWrapper(event.getSenderInfo());
    }

    @Override
    public Date getCreatedAt() {
        return new Date(event.getRoot().getOriginServerTs());
    }

    public void setText(String content) {
        this.text = content;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public boolean isEncrypted() {
        return isEncrypted;
    }

    public void setEncrypted(boolean encrypted) {
        isEncrypted = encrypted;
    }

    @Nullable
    @Override
    public String getImageUrl() {
        return imageUrl;
    }
}

