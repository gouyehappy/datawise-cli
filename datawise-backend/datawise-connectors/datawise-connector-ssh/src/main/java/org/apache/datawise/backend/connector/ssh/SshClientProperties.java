package org.apache.datawise.backend.connector.ssh;

import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "datawise.ssh")
public class SshClientProperties {

    private boolean strictHostKeyChecking = true;
    private boolean acceptNewHostKeys = true;
    private String knownHostsPath;
    private int idleTtlMinutes = 30;
    private int connectTimeoutMs = 15_000;
    /** When true, allow legacy ssh-rsa host keys and related algorithms for older servers. */
    private boolean allowLegacyAlgorithms = true;

    public boolean isAllowLegacyAlgorithms() {
        return allowLegacyAlgorithms;
    }

    public void setAllowLegacyAlgorithms(boolean allowLegacyAlgorithms) {
        this.allowLegacyAlgorithms = allowLegacyAlgorithms;
    }

    public boolean isStrictHostKeyChecking() {
        return strictHostKeyChecking;
    }

    public void setStrictHostKeyChecking(boolean strictHostKeyChecking) {
        this.strictHostKeyChecking = strictHostKeyChecking;
    }

    public boolean isAcceptNewHostKeys() {
        return acceptNewHostKeys;
    }

    public void setAcceptNewHostKeys(boolean acceptNewHostKeys) {
        this.acceptNewHostKeys = acceptNewHostKeys;
    }

    public String getKnownHostsPath() {
        return knownHostsPath;
    }

    public void setKnownHostsPath(String knownHostsPath) {
        this.knownHostsPath = knownHostsPath != null ? knownHostsPath.trim() : null;
    }

    public int getIdleTtlMinutes() {
        return idleTtlMinutes;
    }

    public void setIdleTtlMinutes(int idleTtlMinutes) {
        this.idleTtlMinutes = Math.max(0, idleTtlMinutes);
    }

    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public void setConnectTimeoutMs(int connectTimeoutMs) {
        this.connectTimeoutMs = Math.max(1_000, connectTimeoutMs);
    }

    void configureKnownHosts(JSch jsch) throws JSchException {
        SshKnownHostsSupport.configureKnownHosts(jsch, this);
    }

    void persistKnownHosts(JSch jsch) {
        SshKnownHostsSupport.persistKnownHosts(jsch, this);
    }

    String strictHostKeyCheckingMode() {
        return SshKnownHostsSupport.strictHostKeyCheckingMode(this);
    }
}
