import ports from '../../../runtime-ports.json' with {type: 'json'}

export const BACKEND_PORT = ports.backend
export const FRONTEND_DEV_PORT = ports.frontendDev
export const FRONTEND_E2E_PORT = ports.frontendE2e
export const CDS_TRAIN_PORT = ports.cdsTrain

export function backendBaseUrl(host: '127.0.0.1' | 'localhost' = '127.0.0.1'): string {
    return `http://${host}:${BACKEND_PORT}`
}

export function frontendDevOrigin(host: '127.0.0.1' | 'localhost' = '127.0.0.1'): string {
    return `http://${host}:${FRONTEND_DEV_PORT}`
}
