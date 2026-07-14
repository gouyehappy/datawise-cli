package org.apache.datawise.backend.service.ssh;

import org.apache.datawise.backend.model.SshScriptRecord;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Seeds built-in quick-command records into each SSH connection's script store on first access.
 * Users may edit or delete them like any other record. Built-ins are only re-added when the store
 * is completely empty; deleted built-ins stay deleted. Blank built-in content is repaired in place.
 */
final class SshScriptRecordBootstrap {

    static final String BUILTIN_PREFIX = "builtin-";

    private SshScriptRecordBootstrap() {
    }

    static List<SshScriptRecord> ensureDefaults(List<SshScriptRecord> existing, long now) {
        if (existing == null || existing.isEmpty()) {
            return new ArrayList<>(builtInRecords(now));
        }

        Map<String, String> defaultHtmlById = new LinkedHashMap<>();
        for (SshScriptRecord defaults : builtInRecords(now)) {
            defaultHtmlById.put(defaults.getId(), defaults.getContentHtml());
        }

        List<SshScriptRecord> repaired = new ArrayList<>(existing.size());
        boolean changed = false;
        for (SshScriptRecord record : existing) {
            if (record == null || record.getId() == null || record.getId().isBlank()) {
                continue;
            }
            String defaultHtml = defaultHtmlById.get(record.getId());
            if (defaultHtml != null && isBlank(record.getContentHtml())) {
                record.setContentHtml(defaultHtml);
                if (record.getUpdatedAt() <= 0) {
                    record.setUpdatedAt(now);
                }
                changed = true;
            }
            repaired.add(record);
        }
        return changed ? repaired : existing;
    }

    static boolean isBuiltInId(String recordId) {
        return recordId != null && recordId.startsWith(BUILTIN_PREFIX);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static List<SshScriptRecord> builtInRecords(long now) {
        return List.of(
                record(
                        "builtin-logs",
                        "日志",
                        """
                        @run
                        # 最近日志
                        journalctl -n 80 --no-pager 2>/dev/null || tail -n 80 /var/log/messages 2>/dev/null || tail -n 80 /var/log/syslog
                        # 日志目录
                        ls -lt /var/log 2>/dev/null | head -n 12
                        """,
                        now
                ),
                record(
                        "builtin-status",
                        "状态",
                        """
                        @run
                        # 运行时间
                        uptime
                        # 磁盘
                        df -h
                        # 内存
                        free -h 2>/dev/null || vm_stat
                        # 进程
                        ps aux --sort=-%cpu 2>/dev/null | head -n 15 || ps aux | head -n 15
                        # 端口
                        ss -tlnp 2>/dev/null | head -n 20 || netstat -tlnp 2>/dev/null | head -n 20
                        """,
                        now
                ),
                record(
                        "builtin-yarn",
                        "YARN",
                        """
                        @paste
                        # 应用列表
                        yarn application -list
                        # 应用日志
                        yarn logs -applicationId {{appId}} 2>/dev/null | tail -n 200
                        # KILL 应用
                        yarn application -kill {{appId}}
                        # 节点列表
                        yarn node -list -all
                        """,
                        now
                ),
                record(
                        "builtin-kafka",
                        "Kafka",
                        """
                        @paste
                        # Topic 列表
                        kafka-topics.sh --bootstrap-server localhost:9092 --list 2>/dev/null || kafka-topics --bootstrap-server localhost:9092 --list
                        # 消费组
                        kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list 2>/dev/null || kafka-consumer-groups --bootstrap-server localhost:9092 --list
                        # 查看 Topic
                        kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic {{topic}} 2>/dev/null || kafka-topics --bootstrap-server localhost:9092 --describe --topic {{topic}}
                        """,
                        now
                )
        );
    }

    private static SshScriptRecord record(String id, String title, String plainText, long updatedAt) {
        SshScriptRecord record = new SshScriptRecord();
        record.setId(id);
        record.setTitle(title);
        // Store plain text (contentHtml is a legacy field name).
        record.setContentHtml(plainText.strip() + "\n");
        record.setUpdatedAt(updatedAt);
        return record;
    }
}
