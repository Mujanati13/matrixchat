package com.me.matrixchat.Models;

public class AuthResponse {
    private String userId;  // Matrix user ID
    private String accessToken;
    private String deviceId;

    // Constructors, Getters, and Setters

    public AuthResponse() {
    }

    public AuthResponse(String userId, String accessToken, String deviceId) {
        this.userId = userId;
        this.accessToken = accessToken;
        this.deviceId = deviceId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }
}

