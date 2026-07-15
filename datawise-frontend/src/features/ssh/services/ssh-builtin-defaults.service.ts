import type {SshCommandItem, SshScriptRecord} from '@/features/ssh/types/ssh-script-record.types'
import {createSshCommandItem} from '@/features/ssh/types/ssh-script-record.types'
import {
    hasStructuredCommands,
    hydrateSshScriptRecord,
    isBuiltInScriptRecordId,
    serializeCommandEntries,
} from '@/features/ssh/services/ssh-my-commands.service'

function cmds(...items: Array<Omit<SshCommandItem, 'description'> & {description?: string}>): SshCommandItem[] {
    return items.map((item) => createSshCommandItem(item))
}

const BUILTIN_RECORDS: Record<string, {title: string; commands: SshCommandItem[]}> = {
    'builtin-common': {
        title: '常用',
        commands: cmds(
            {title: '当前用户', command: 'whoami; id', mode: 'run', description: '查看登录用户与身份'},
            {title: '主机信息', command: 'hostname; uname -a', mode: 'run', description: '主机名与内核'},
            {title: '当前时间', command: 'date; timedatectl 2>/dev/null | head -n 8', mode: 'run'},
            {
                title: '目录占用',
                command: 'du -h --max-depth=1 2>/dev/null | sort -hr | head -n 20',
                mode: 'run',
            },
            {
                title: '大文件',
                command: 'find / -xdev -type f -size +500M 2>/dev/null | head -n 30',
                mode: 'paste',
            },
            {title: '网络地址', command: 'ip -br a 2>/dev/null || ifconfig', mode: 'run'},
            {title: '路由', command: 'ip route 2>/dev/null || route -n', mode: 'run'},
            {title: '环境变量', command: 'env | sort | head -n 40', mode: 'run'},
        ),
    },
    'builtin-logs': {
        title: '日志',
        commands: cmds(
            {
                title: '最近日志',
                command: 'journalctl -n 80 --no-pager 2>/dev/null || tail -n 80 /var/log/messages 2>/dev/null || tail -n 80 /var/log/syslog',
                mode: 'run',
            },
            {
                title: '错误日志',
                command: "journalctl -p err -n 50 --no-pager 2>/dev/null || grep -iE 'error|exception|fail' /var/log/messages 2>/dev/null | tail -n 50",
                mode: 'run',
            },
            {title: '日志目录', command: 'ls -lt /var/log 2>/dev/null | head -n 20', mode: 'run'},
            {
                title: '跟踪 syslog',
                command: 'journalctl -f --no-pager 2>/dev/null || tail -f /var/log/messages 2>/dev/null || tail -f /var/log/syslog',
                mode: 'paste',
                description: '前台跟随，需手动 Ctrl+C',
            },
        ),
    },
    'builtin-status': {
        title: '状态',
        commands: cmds(
            {title: '运行时间', command: 'uptime', mode: 'run'},
            {title: '磁盘', command: 'df -hT', mode: 'run'},
            {title: 'inode', command: 'df -i', mode: 'run'},
            {title: '内存', command: 'free -h 2>/dev/null || vm_stat', mode: 'run'},
            {
                title: '负载 Top',
                command: 'top -b -n 1 2>/dev/null | head -n 25 || top -l 1 2>/dev/null | head -n 25',
                mode: 'run',
            },
            {
                title: '进程 CPU',
                command: 'ps aux --sort=-%cpu 2>/dev/null | head -n 20 || ps aux | head -n 20',
                mode: 'run',
            },
            {
                title: '进程内存',
                command: 'ps aux --sort=-%mem 2>/dev/null | head -n 20 || ps aux | head -n 20',
                mode: 'run',
            },
            {
                title: '端口',
                command: 'ss -tlnp 2>/dev/null | head -n 30 || netstat -tlnp 2>/dev/null | head -n 30',
                mode: 'run',
            },
            {title: '系统服务失败', command: 'systemctl --failed 2>/dev/null || true', mode: 'run'},
        ),
    },
    'builtin-yarn': {
        title: 'YARN',
        commands: cmds(
            {title: '应用列表', command: 'yarn application -list', mode: 'paste'},
            {title: '运行中应用', command: 'yarn application -list -appStates RUNNING', mode: 'paste'},
            {title: '应用状态', command: 'yarn application -status {{appId}}', mode: 'paste'},
            {
                title: '应用日志',
                command: 'yarn logs -applicationId {{appId}} 2>/dev/null | tail -n 200',
                mode: 'paste',
            },
            {title: 'KILL 应用', command: 'yarn application -kill {{appId}}', mode: 'paste'},
            {title: '节点列表', command: 'yarn node -list -all', mode: 'paste'},
            {
                title: '队列',
                command: 'yarn queue -list 2>/dev/null || yarn scheduler -showJobs 2>/dev/null || true',
                mode: 'paste',
            },
            {title: '集群指标', command: 'yarn top 2>/dev/null || yarn node -list', mode: 'paste'},
            {
                title: 'RM 状态',
                command: 'yarn rmadmin -getServiceState rm 2>/dev/null || curl -s http://localhost:8088/ws/v1/cluster/info 2>/dev/null | head -c 800',
                mode: 'paste',
            },
        ),
    },
    'builtin-kafka': {
        title: 'Kafka',
        commands: cmds(
            {
                title: 'Topic 列表',
                command: 'kafka-topics.sh --bootstrap-server localhost:9092 --list 2>/dev/null || kafka-topics --bootstrap-server localhost:9092 --list',
                mode: 'paste',
            },
            {
                title: '查看 Topic',
                command: 'kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic {{topic}} 2>/dev/null || kafka-topics --bootstrap-server localhost:9092 --describe --topic {{topic}}',
                mode: 'paste',
            },
            {
                title: '消费组列表',
                command: 'kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list 2>/dev/null || kafka-consumer-groups --bootstrap-server localhost:9092 --list',
                mode: 'paste',
            },
            {
                title: '消费组详情',
                command: 'kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group {{groupId}} 2>/dev/null || kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group {{groupId}}',
                mode: 'paste',
            },
            {
                title: '消费消息',
                command: 'kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic {{topic}} --from-beginning --max-messages 20 2>/dev/null || kafka-console-consumer --bootstrap-server localhost:9092 --topic {{topic}} --from-beginning --max-messages 20',
                mode: 'paste',
            },
            {
                title: '生产消息',
                command: 'kafka-console-producer.sh --bootstrap-server localhost:9092 --topic {{topic}} 2>/dev/null || kafka-console-producer --bootstrap-server localhost:9092 --topic {{topic}}',
                mode: 'paste',
                description: '交互写入，Ctrl+C 结束',
            },
            {
                title: 'Topic 配置',
                command: 'kafka-configs.sh --bootstrap-server localhost:9092 --entity-type topics --entity-name {{topic}} --describe 2>/dev/null || kafka-configs --bootstrap-server localhost:9092 --entity-type topics --entity-name {{topic}} --describe',
                mode: 'paste',
            },
        ),
    },
    'builtin-mongodb': {
        title: 'MongoDB',
        commands: cmds(
            {
                title: '库列表',
                command: 'mongosh --quiet --eval \'db.adminCommand({ listDatabases: 1 }).databases.map(d => d.name).join("\\n")\' 2>/dev/null || mongo --quiet --eval \'db.adminCommand({ listDatabases: 1 }).databases.forEach(d => print(d.name))\'',
                mode: 'paste',
            },
            {
                title: '集合列表',
                command: 'mongosh {{db}} --quiet --eval \'db.getCollectionNames().join("\\n")\' 2>/dev/null || mongo {{db}} --quiet --eval \'db.getCollectionNames().forEach(printjson)\'',
                mode: 'paste',
            },
            {
                title: '抽样查询',
                command: 'mongosh {{db}} --quiet --eval \'db.getCollection("{{collection}}").find().limit(10).toArray()\' 2>/dev/null || mongo {{db}} --quiet --eval \'db.getCollection("{{collection}}").find().limit(10).forEach(printjson)\'',
                mode: 'paste',
            },
            {
                title: '集合统计',
                command: 'mongosh {{db}} --quiet --eval \'printjson(db.getCollection("{{collection}}").stats())\' 2>/dev/null || mongo {{db}} --quiet --eval \'printjson(db.getCollection("{{collection}}").stats())\'',
                mode: 'paste',
            },
            {
                title: '索引',
                command: 'mongosh {{db}} --quiet --eval \'printjson(db.getCollection("{{collection}}").getIndexes())\' 2>/dev/null || mongo {{db}} --quiet --eval \'printjson(db.getCollection("{{collection}}").getIndexes())\'',
                mode: 'paste',
            },
            {
                title: '服务器状态',
                command: 'mongosh --quiet --eval \'printjson(db.serverStatus())\' 2>/dev/null || mongo --quiet --eval \'printjson(db.serverStatus())\'',
                mode: 'paste',
            },
            {
                title: '副本集状态',
                command: 'mongosh --quiet --eval \'try { printjson(rs.status()) } catch (e) { print(e) }\' 2>/dev/null || mongo --quiet --eval \'try { printjson(rs.status()) } catch(e) { print(e) }\'',
                mode: 'paste',
            },
        ),
    },
}

export function resolveBuiltinCommandPlainText(recordId: string): string | null {
    const builtin = BUILTIN_RECORDS[recordId]
    if (!builtin) return null
    return serializeCommandEntries(builtin.commands)
}

export function resolveBuiltinCommands(recordId: string): SshCommandItem[] | null {
    return BUILTIN_RECORDS[recordId]?.commands ?? null
}

/** Repair blank built-in records and hydrate legacy DSL into structured commands. */
export function repairSshScriptRecords(records: SshScriptRecord[]): SshScriptRecord[] {
    const repaired = records.map((record) => {
        let next = record
        if (isBuiltInScriptRecordId(record.id)
            && !hasStructuredCommands(record)
            && !record.contentHtml?.trim()) {
            const builtin = BUILTIN_RECORDS[record.id]
            if (builtin) {
                next = {
                    ...record,
                    title: record.title?.trim() || builtin.title,
                    commands: builtin.commands,
                    contentHtml: serializeCommandEntries(builtin.commands),
                }
            }
        }
        return hydrateSshScriptRecord(next)
    })

    const present = new Set(repaired.map((item) => item.id))
    const missing: SshScriptRecord[] = []
    for (const [id, builtin] of Object.entries(BUILTIN_RECORDS)) {
        if (present.has(id)) continue
        missing.push({
            id,
            title: builtin.title,
            commands: builtin.commands,
            contentHtml: serializeCommandEntries(builtin.commands),
            updatedAt: Date.now(),
        })
    }
    return missing.length ? [...repaired, ...missing] : repaired
}
