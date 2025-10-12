package com.me.matrixchat.Models;

public class User {
    private String matrixId; // e.g., "@user:yourserver.com"
    private String displayName;
    private String avatarUrl;
    private boolean isOnline;

    // Constructors, Getters, and Setters

    public User() {
    }

    public User(String matrixId, String displayName, String avatarUrl, boolean isOnline) {
        this.matrixId = matrixId;
        this.displayName = displayName;
        this.avatarUrl = avatarUrl;
        this.isOnline = isOnline;
    }

    public String getMatrixId() {
        return matrixId;
    }

    public void setMatrixId(String matrixId) {
        this.matrixId = matrixId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public boolean isOnline() {
        return isOnline;
    }

    public void setOnline(boolean online) {
        isOnline = online;
    }
}

