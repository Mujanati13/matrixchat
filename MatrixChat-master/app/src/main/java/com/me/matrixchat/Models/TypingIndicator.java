package com.me.matrixchat.Models;

public class TypingIndicator {
    private String userId;
    private String roomId;
    private boolean isTyping;

    // Constructors, Getters, and Setters

    public TypingIndicator() {
    }

    public TypingIndicator(String userId, String roomId, boolean isTyping) {
        this.userId = userId;
        this.roomId = roomId;
        this.isTyping = isTyping;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public boolean isTyping() {
        return isTyping;
    }

    public void setTyping(boolean typing) {
        isTyping = typing;
    }
}
