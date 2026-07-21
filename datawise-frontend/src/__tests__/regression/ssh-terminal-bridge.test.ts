import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {createSshTerminalBridge} from '@/features/terminal/services/ssh-terminal.bridge'

describe('ssh-terminal.bridge', () => {
    it('buffers early shell output until onOutput subscribes', async () => {
        const originalWebSocket = globalThis.WebSocket
        const listeners = new Map<string, Set<(event: {data: string}) => void>>()

        class MockWebSocket {
            static OPEN = 1
            readyState = MockWebSocket.OPEN

            addEventListener(type: string, handler: (event: {data: string}) => void) {
                const bucket = listeners.get(type) ?? new Set()
                bucket.add(handler)
                listeners.set(type, bucket)
                if (type === 'open') {
                    queueMicrotask(() => handler({data: ''}))
                }
            }

            send() {}

            close() {}
        }

        globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
        globalThis.localStorage = {
            getItem: (key: string) => (key === 'dw-cli-session-id' ? 'test-session' : null),
            setItem: () => {},
            removeItem: () => {},
            clear: () => {},
            key: () => null,
            length: 0,
        } as Storage

        try {
            const bridge = createSshTerminalBridge('conn-1')
            const sessionId = 'session-1'
            const createPromise = bridge.create(sessionId, {cols: 120, rows: 30})

            for (const handler of listeners.get('message') ?? []) {
                handler({
                    data: JSON.stringify({
                        type: 'output',
                        sessionId,
                        data: 'root@host:~# ',
                    }),
                })
                handler({
                    data: JSON.stringify({
                        type: 'created',
                        sessionId,
                        ok: true,
                    }),
                })
            }

            const created = await createPromise
            assert.equal(created.ok, true)

            const chunks: string[] = []
            bridge.onOutput(sessionId, (data) => chunks.push(data))
            assert.deepEqual(chunks, ['root@host:~# '])
            await bridge.destroy(sessionId)
        } finally {
            globalThis.WebSocket = originalWebSocket
        }
    })
})
