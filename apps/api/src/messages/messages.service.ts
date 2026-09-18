import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getMessages(conversationId: string) {
    const conversation = await this.prisma.conversationThread.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(conversationId: string, content: string) {
    // Verify conversation exists
    const conversation = await this.prisma.conversationThread.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    // 1. Fetch previous history
    const pastMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    // 2. Save user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content,
      },
    });

    // 3. Call Python AI Agent
    const agentUrl = this.config.get<string>('AI_AGENT_URL', 'http://localhost:8000');
    
    let aiReply = 'Maaf, saya tidak dapat merespons saat ini.';
    let intent = 'general';

    try {
      const history = pastMessages.map(m => ({
        role: m.role,
        content: m.content || '',
      }));

      const response = await fetch(`${agentUrl}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationId,
          history,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        aiReply = data.response || aiReply;
        intent = data.intent || intent;
      }
    } catch (error) {
      console.error('AI Agent error:', error);
    }

    // 3. Save AI response
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: aiReply,
      },
    });

    // 4. Create workflow run
    await this.prisma.workflowRun.create({
      data: {
        conversationId,
        intent,
        status: 'completed',
        completedAt: new Date(),
      },
    });

    return { userMessage, assistantMessage, intent };
  }
}
