package org.apache.datawise.backend.model;

/**
 * Per-user SSH connection script note (rich HTML content).
 */
public class SshScriptRecord {

    private String id;
    private String title;
    private String contentHtml;
    private long updatedAt;

    public SshScriptRecord() {
    }

    public SshScriptRecord(String id, String title, String contentHtml, long updatedAt) {
        this.id = id;
        this.title = title;
        this.contentHtml = contentHtml;
        this.updatedAt = updatedAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContentHtml() {
        return contentHtml;
    }

    public void setContentHtml(String contentHtml) {
        this.contentHtml = contentHtml;
    }

    public long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(long updatedAt) {
        this.updatedAt = updatedAt;
    }
}
