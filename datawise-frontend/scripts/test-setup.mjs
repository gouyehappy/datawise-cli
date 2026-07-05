/**
 * Node test bootstrap: browser globals used at module load time (localStorage, import.meta.env).
 */
const storage = new Map()

function createStorage() {
    return {
        getItem(key) {
            return storage.has(key) ? storage.get(key) : null
        },
        setItem(key, value) {
            storage.set(key, String(value))
        },
        removeItem(key) {
            storage.delete(key)
        },
        clear() {
            storage.clear()
        },
        key(index) {
            return [...storage.keys()][index] ?? null
        },
        get length() {
            return storage.size
        },
    }
}

if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
        value: createStorage(),
        configurable: true,
    })
}

if (typeof globalThis.sessionStorage === 'undefined') {
    Object.defineProperty(globalThis, 'sessionStorage', {
        value: createStorage(),
        configurable: true,
    })
}

/** Minimal DOMParser for app-config-xml unit tests (CDATA JSON sections). */
if (typeof globalThis.DOMParser === 'undefined') {
    globalThis.DOMParser = class DOMParser {
        parseFromString(source, _type) {
            const cdataSections = new Map()
            for (const match of source.matchAll(/<([a-zA-Z0-9_-]+)[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/\1>/g)) {
                cdataSections.set(match[1], match[2])
            }
            const root = {
                tagName: 'datawise-app',
                getAttribute(name) {
                    if (name === 'version') return source.match(/version="(\d+)"/)?.[1] ?? null
                    if (name === 'exported-at') return source.match(/exported-at="([^"]+)"/)?.[1] ?? null
                    return null
                },
                getElementsByTagName(tagName) {
                    const text = cdataSections.get(tagName)
                    return {
                        item(index) {
                            if (index !== 0 || text == null) return null
                            return {textContent: text}
                        },
                    }
                },
            }
            return {documentElement: root}
        }
    }
}

const env = import.meta.env ?? {}
if (env.DEV === undefined) {
    Object.assign(import.meta, {
        env: {
            ...env,
            DEV: false,
            PROD: true,
            MODE: 'test',
        },
    })
}
