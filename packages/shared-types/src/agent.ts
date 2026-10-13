export interface AgentChatRequest {
  message: string;
  conversationId: string;
  model?: string;
}

export type LlmProvider = 'gemini' | 'groq';

export interface LlmModelOption {
  id: string;
  label: string;
  provider: LlmProvider;
  description: string;
  available?: boolean;
}

export interface AgentChatResponse {
  response: string;
  intent: string;
}

export type AgentIntent =
  | 'general'
  | 'support'
  | 'research'
  | 'brainstorm'
  | 'learning'
  | 'assignment';

export interface Memory {
  id: string;
  userId: string;
  content: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowRun {
  id: string;
  conversationId: string;
  intent: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}
