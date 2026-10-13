export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string | null;
  createdAt: Date;
}

export interface SendMessageDto {
  content: string;
  mode?: string;
  /** ID model LLM pilihan user, mis. "gemini-2.5-flash" atau "llama-3.3-70b-versatile". */
  model?: string;
}
