package com.me.matrixchat.Models;

public class FileUpload {
    private String fileUrl;  // Matrix Media URL (mxc://)
    private String fileType; // e.g., "image/png", "video/mp4"
    private String uploaderId;
    private String timestamp;

    // Constructors, Getters, and Setters

    public FileUpload() {
    }

    public FileUpload(String fileUrl, String fileType, String uploaderId, String timestamp) {
        this.fileUrl = fileUrl;
        this.fileType = fileType;
        this.uploaderId = uploaderId;
        this.timestamp = timestamp;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getFileType() {
        return fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public String getUploaderId() {
        return uploaderId;
    }

    public void setUploaderId(String uploaderId) {
        this.uploaderId = uploaderId;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }
}
