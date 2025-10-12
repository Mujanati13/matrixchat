package com.me.matrixchat.Models;

public class RecoveryKey {
    private String userId;
    private String hashedRecoveryKey;  // Store securely
    private String createdAt;

    // Constructors, Getters, and Setters

    public RecoveryKey() {
    }

    public RecoveryKey(String userId, String hashedRecoveryKey, String createdAt) {
        this.userId = userId;
        this.hashedRecoveryKey = hashedRecoveryKey;
        this.createdAt = createdAt;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getHashedRecoveryKey() {
        return hashedRecoveryKey;
    }

    public void setHashedRecoveryKey(String hashedRecoveryKey) {
        this.hashedRecoveryKey = hashedRecoveryKey;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}

