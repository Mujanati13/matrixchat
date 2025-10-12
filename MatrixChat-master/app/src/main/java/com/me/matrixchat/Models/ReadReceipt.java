package com.me.matrixchat.Models;

public class ReadReceipt {
    private String userId;
    private String messageId;
    private String roomId;
    private String timestamp;

    // Constructors, Getters, and Setters

    public ReadReceipt() {
    }

    public ReadReceipt(String userId, String messageId, String roomId, String timestamp) {
        this.userId = userId;
        this.messageId = messageId;
        this.roomId = roomId;
        this.timestamp = timestamp;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }
}

