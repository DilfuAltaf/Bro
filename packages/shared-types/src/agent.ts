export interface AgentChatRequest {
  message: string;
  conversationId: string;
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
