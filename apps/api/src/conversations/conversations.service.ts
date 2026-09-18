import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  findAll(userId?: string) {
    if (userId) {
      return this.prisma.conversationThread.findMany({ where: { userId } });
    }
    return this.prisma.conversationThread.findMany();
  }

  async findById(id: string) {
    const thread = await this.prisma.conversationThread.findUnique({
      where: { id },
      include: {
        messages: true,
      }
    });
    if (!thread) throw new NotFoundException('Conversation thread not found');
    return thread;
  }

  create(data: CreateConversationDto) {
    return this.prisma.conversationThread.create({ data });
  }

  update(id: string, data: UpdateConversationDto) {
    return this.prisma.conversationThread.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return this.prisma.conversationThread.delete({
      where: { id },
    });
  }
}
