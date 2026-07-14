import type {SshScriptRecord} from '@/features/ssh/types/ssh-script-record.types'
import {toStoredCommandText} from '@/features/ssh/services/ssh-script-record-content.service'
import {isBuiltInScriptRecordId} from '@/features/ssh/services/ssh-my-commands.service'

const BUILTIN_PLAIN_TEXT: Record<string, {title: string; text: string}> = {
    'builtin-logs': {
        title: '日志',
        text: `@run
# 最近日志
journalctl -n 80 --no-pager 2>/dev/null || tail -n 80 /var/log/messages 2>/dev/null || tail -n 80 /var/log/syslog
# 日志目录
ls -lt /var/log 2>/dev/null | head -n 12
`,
    },
    'builtin-status': {
        title: '状态',
        text: `@run
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
`,
    },
    'builtin-yarn': {
        title: 'YARN',
        text: `@paste
# 应用列表
yarn application -list
# 应用日志
yarn logs -applicationId {{appId}} 2>/dev/null | tail -n 200
# KILL 应用
yarn application -kill {{appId}}
# 节点列表
yarn node -list -all
`,
    },
    'builtin-kafka': {
        title: 'Kafka',
        text: `@paste
# Topic 列表
kafka-topics.sh --bootstrap-server localhost:9092 --list 2>/dev/null || kafka-topics --bootstrap-server localhost:9092 --list
# 消费组
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list 2>/dev/null || kafka-consumer-groups --bootstrap-server localhost:9092 --list
# 查看 Topic
kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic {{topic}} 2>/dev/null || kafka-topics --bootstrap-server localhost:9092 --describe --topic {{topic}}
`,
    },
}

export function resolveBuiltinCommandPlainText(recordId: string): string | null {
    return BUILTIN_PLAIN_TEXT[recordId]?.text ?? null
}

/** Repair blank built-in records so quick-ops / editor stay usable after corrupted autosaves. */
export function repairSshScriptRecords(records: SshScriptRecord[]): SshScriptRecord[] {
    return records.map((record) => {
        if (!isBuiltInScriptRecordId(record.id)) return record
        if (record.contentHtml?.trim()) return record
        const builtin = BUILTIN_PLAIN_TEXT[record.id]
        if (!builtin) return record
        return {
            ...record,
            title: record.title?.trim() || builtin.title,
            contentHtml: toStoredCommandText(builtin.text),
        }
    })
}
