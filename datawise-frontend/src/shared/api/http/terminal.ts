import type {TerminalApi} from '@/shared/api/types'
import {getJson, postJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'
import type {TerminalExecResult, TerminalStatus} from '@/shared/api/types'

export function createHttpTerminalApi(): TerminalApi {
    return {
        execute: async (input, ctx) =>
            postJson<TerminalExecResult>(API_PATHS.terminal.execute, {
                input,
                cwd: ctx.cwd,
                platform: ctx.platform,
            }),

        welcome: async (platform) => {
            const data = await getJson<string>(API_PATHS.terminal.welcome, {platform})
            return data
        },

        status: async () => getJson<TerminalStatus>(API_PATHS.terminal.status),
    }
}
