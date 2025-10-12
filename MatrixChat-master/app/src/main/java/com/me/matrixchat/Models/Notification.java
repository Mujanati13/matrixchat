package com.me.matrixchat.Models;

public class Notification {
    private String notificationId;
    private String messageId;
    private String senderId;
    private String roomId;
    private boolean isRead;

    // Constructors, Getters, and Setters

    public Notification() {
    }

    public Notification(String notificationId, String messageId, String senderId, String roomId, boolean isRead) {
        this.notificationId = notificationId;
        this.messageId = messageId;
        this.senderId = senderId;
        this.roomId = roomId;
        this.isRead = isRead;
    }

    public String getNotificationId() {
        return notificationId;
    }

    public void setNotificationId(String notificationId) {
        this.notificationId = notificationId;
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

    public boolean isRead() {
        return isRead;
    }

    public void setRead(boolean read) {
        isRead = read;
    }
}

