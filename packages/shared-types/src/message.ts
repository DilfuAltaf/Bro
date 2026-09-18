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
}
