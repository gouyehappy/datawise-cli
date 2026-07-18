import type {TreeNode} from '@/core/types'
import {
    resolveConnectionEnvironmentLabel,
} from '@/features/connection/services/connection-environment.service'
import type {DataQualityGateResult, DataQualityGateScopeResult} from '@/features/platform/types/platform.types'

export interface DataQualityReferenceConnectionOption {
    value: string
    label: string
    envLabel: string
}

/** Other connections for multi-env gate (exclude current). */
export function listDataQualityReferenceConnections(
    tree: readonly TreeNode[],
    currentConnectionId: string | null | undefined,
    t: (key: string, params?: Record<string, unknown>) => string,
): DataQualityReferenceConnectionOption[] {
    const current = currentConnectionId?.trim() ?? ''
    const options: DataQualityReferenceConnectionOption[] = []
    const walk = (nodes: readonly TreeNode[]) => {
        for (const node of nodes) {
            if (node.type === 'connection' && node.id !== current) {
                const envLabel = resolveConnectionEnvironmentLabel(node.env, node.envCustom, t)
                options.push({
                    value: node.id,
                    label: `${node.label || node.id} (${envLabel})`,
                    envLabel,
                })
            }
            if (node.children?.length) walk(node.children)
        }
    }
    walk(tree)
    return options
}

export function summarizeMultiEnvGate(
    result: DataQualityGateResult,
    scopeLabel: (scope: DataQualityGateScopeResult, index: number) => string,
): {passed: boolean; summaryParts: string[]} {
    const scopes = result.scopes?.length ? result.scopes : null
    if (!scopes) {
        return {
            passed: result.passed,
            summaryParts: [`${result.failed}/${result.total}`],
        }
    }
    return {
        passed: result.passed,
        summaryParts: scopes.map((scope, index) => {
            const label = scopeLabel(scope, index)
            return `${label}: ${scope.failed}/${scope.total}`
        }),
    }
}
