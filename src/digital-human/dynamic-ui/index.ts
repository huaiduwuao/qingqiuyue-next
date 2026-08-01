/**
 * Dynamic UI 动态 UI 渲染器
 *
 * @example
 * ```tsx
 * import { DynamicUIRenderer, DynamicUIModal } from './dynamic-ui'
 *
 * function MyComponent() {
 *   const [ui, setUI] = useState<DynamicUI | null>(null)
 *
 *   return (
 *     <>
 *       <DynamicUIModal
 *         ui={ui}
 *         onClose={() => setUI(null)}
 *         onAction={(action) => console.log('action:', action)}
 *       />
 *     </>
 *   )
 * }
 * ```
 */

// Re-export types
export * from './types'

// Re-export components
export { DynamicUIModal } from './DynamicUIModal'
export { ListRenderer } from './ListRenderer'
export { GridRenderer } from './GridRenderer'
export { FormRenderer } from './FormRenderer'

// Re-export hooks
export { useIntentHub, useDigitalHumanIntentHub, useMultiAgentIntentHub } from './useIntentHub'
export { useIntentHubIntegration, useImmersiveIntentHub, createIntentInterceptor } from '../hooks/useIntentHubIntegration'
export { useDigitalHumanIntentFlow, useSmartDigitalHuman } from '../hooks/useDigitalHumanIntentFlow'
