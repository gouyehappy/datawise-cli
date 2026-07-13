package org.apache.datawise.backend.service.ssh;

import org.apache.datawise.backend.model.SshScriptRecord;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Seeds built-in quick-command records into each SSH connection's script store on first access.
 * Users may edit or delete them like any other record; missing defaults are re-added on list.
 */
final class SshScriptRecordBootstrap {

    static final String BUILTIN_PREFIX = "builtin-";

    private SshScriptRecordBootstrap() {
    }

    static List<SshScriptRecord> ensureDefaults(List<SshScriptRecord> existing, long now) {
        Map<String, SshScriptRecord> merged = new LinkedHashMap<>();
        if (existing != null) {
            for (SshScriptRecord record : existing) {
                if (record != null && record.getId() != null && !record.getId().isBlank()) {
                    merged.put(record.getId(), record);
                }
            }
        }
        Set<String> present = merged.keySet();
        for (SshScriptRecord defaults : builtInRecords(now)) {
            if (!present.contains(defaults.getId())) {
                merged.put(defaults.getId(), defaults);
            }
        }
        return new ArrayList<>(merged.values());
    }

    static boolean isBuiltInId(String recordId) {
        return recordId != null && recordId.startsWith(BUILTIN_PREFIX);
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
        record.setContentHtml(toPreHtml(plainText.strip() + "\n"));
        record.setUpdatedAt(updatedAt);
        return record;
    }

    private static String toPreHtml(String text) {
        return "<pre>" + escapeHtml(text) + "</pre>";
    }

    private static String escapeHtml(String text) {
        return text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}
