import ports from '../runtime-ports.json' with {type: 'json'}

export const SPLASH_WIDTH = 680
export const SPLASH_HEIGHT = 420

const DEV_BACKEND = `127.0.0.1:${ports.dev.backend}`
const PACKAGED_BACKEND = `127.0.0.1:${ports.desktop.backend}`

export function resolveBackendSplashStatus(phase: string, isPackaged: boolean): string {
    const endpoint = isPackaged ? PACKAGED_BACKEND : DEV_BACKEND
    switch (phase) {
        case 'config':
            return isPackaged
                ? '正在准备工作区目录与配置文件…'
                : '正在加载开发环境工作区配置…'
        case 'spawning':
            return `正在启动后端服务 (${endpoint})…`
        case 'warming':
            return `正在等待 Spring Boot 服务就绪 (${endpoint}/api/health)…`
        case 'session':
            return '正在建立用户会话与鉴权令牌…'
        case 'sync':
            return '正在同步连接、SQL 片段与编辑器设置…'
        case 'ready':
            return '正在加载主界面与资源树…'
        case 'complete':
            return '启动完成，正在进入工作台…'
        case 'failed':
            return '服务启动失败，请查看运行日志'
        case 'idle':
        default:
            return '正在启动桌面客户端…'
    }
}

export function resolveSplashStatus(phase: string, isPackaged: boolean): string {
    return resolveBackendSplashStatus(phase, isPackaged)
}
