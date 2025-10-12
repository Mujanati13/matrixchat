package com.me.matrixchat.Models;

import java.util.List;

public class Room {
    private String roomId;
    private String roomName;
    private List<String> participants; // List of Matrix IDs
    private boolean isEncrypted;

    // Constructors, Getters, and Setters

    public Room() {
    }

    public Room(String roomId, String roomName, List<String> participants, boolean isEncrypted) {
        this.roomId = roomId;
        this.roomName = roomName;
        this.participants = participants;
        this.isEncrypted = isEncrypted;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getRoomName() {
        return roomName;
    }

    public void setRoomName(String roomName) {
        this.roomName = roomName;
    }

    public List<String> getParticipants() {
        return participants;
    }

    public void setParticipants(List<String> participants) {
        this.participants = participants;
    }

    public boolean isEncrypted() {
        return isEncrypted;
    }

    public void setEncrypted(boolean encrypted) {
        isEncrypted = encrypted;
    }
}

