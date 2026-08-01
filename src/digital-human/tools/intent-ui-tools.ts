/**
 * Intent UI Tools - LLM-callable dynamic UI tools
 * These tools let LLM dynamically generate and control UI
 */

// UI Tool Definitions (plain objects, no TypeScript generics issues)
export const uiTools = [
  {
    name: 'ui.showModal',
    description: 'Display a modal dialog for information, input, or selection. Use for: confirm operations, show details, form input.',
    params: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Dialog title' },
        content: { type: 'string', description: 'Content text' },
        actions: { type: 'array', description: 'Action buttons', items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            style: { type: 'string', enum: ['primary', 'secondary', 'danger'] }
          }
        }}
      }
    }
  },
  {
    name: 'ui.showToast',
    description: 'Display a toast notification that auto-dismisses. Use for: success, error, info notifications.',
    params: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Toast text' },
        duration: { type: 'number', description: 'Duration (ms)', default: 3000 },
        severity: { type: 'string', enum: ['success', 'info', 'warning', 'error'], default: 'info' }
      },
      required: ['message']
    }
  },
  {
    name: 'ui.showChoices',
    description: 'Display a choice list for user selection. Use for: feature selection, confirm operations.',
    params: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Choice title' },
        prompt: { type: 'string', description: 'Prompt text' },
        choices: { type: 'array', description: 'Choice list', items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            description: { type: 'string' },
            icon: { type: 'string' }
          }
        }},
        multiSelect: { type: 'boolean', default: false }
      },
      required: ['title', 'choices']
    }
  },
  {
    name: 'ui.updateAvatar',
    description: 'Update digital human expression, action. Use for: matching dialogue with emotions.',
    params: {
      type: 'object',
      properties: {
        expression: { type: 'string', enum: ['happy', 'sad', 'angry', 'surprised', 'neutral', 'thinking', 'excited'] },
        action: { type: 'string', enum: ['idle', 'wave', 'nod', 'bow', 'dance', 'think', 'talk'] }
      }
    }
  },
  {
    name: 'ui.navigate',
    description: 'Navigate to specified page. Use for: jump to detail, open settings.',
    params: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Page path' },
        target: { type: 'string', enum: ['_self', '_blank'], default: '_self' }
      },
      required: ['path']
    }
  },
  {
    name: 'ui.dismiss',
    description: 'Dismiss current dialog/drawer.',
    params: { type: 'object', properties: {} }
  }
]

export default uiTools
