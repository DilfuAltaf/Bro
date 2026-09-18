export interface ConversationThread {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationDto {
  userId: string;
  title?: string;
}

export interface UpdateConversationDto {
  title?: string;
}
