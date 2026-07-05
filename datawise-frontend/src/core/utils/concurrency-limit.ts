/** 限制并发执行异步任务，避免健康探测等批量请求打满后端。 */
export async function runWithConcurrencyLimit<T>(
    items: readonly T[],
    limit: number,
    worker: (item: T) => Promise<void>,
): Promise<void> {
    if (!items.length) return
    const queue = [...items]
    const concurrency = Math.max(1, Math.min(limit, queue.length))

    async function drain() {
        while (queue.length) {
            const item = queue.shift()
            if (item === undefined) return
            await worker(item)
        }
    }

    await Promise.all(Array.from({length: concurrency}, () => drain()))
}

export const EXPLORER_HEALTH_PROBE_CONCURRENCY = 4
