/**
 * ClawManager API 客户端
 */

export interface Instance {
  id: string
  name: string
  model: string
  status: 'running' | 'stopped'
  createdAt: string
}

interface ListModelsResponse {
  models: { id: string; name: string }[]
}

interface ListInstancesResponse {
  instances: Instance[]
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatCompletionsResponse {
  choices: { message: { content: string } }[]
}

const BASE_URL = process.env.NEXT_PUBLIC_CLAWM_API_URL || '/api/clawm'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${res.status}`)
  }

  return res.json()
}

export const clawmAPI = {
  listModels: () => request<ListModelsResponse>('/models'),

  listInstances: () => request<ListInstancesResponse>('/instances'),

  createInstance: (model: string) =>
    request<Instance>('/instances', {
      method: 'POST',
      body: JSON.stringify({ model }),
    }),

  deleteInstance: (id: string) =>
    request<void>(`/instances/${id}`, { method: 'DELETE' }),

  chatCompletions: (model: string, messages: ChatMessage[]) =>
    request<ChatCompletionsResponse>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model, messages, stream: false }),
    }),

  login: async (username: string, password: string) => {
    await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },

  logout: () => request('/auth/logout', { method: 'POST' }),
}
