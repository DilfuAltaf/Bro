import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { AuthGuard } from '../auth/optional-auth.guard';
import { Request } from 'express';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  findAll(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) return []; // Guests have no permanent history
    return this.conversationsService.findAll(userId);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Req() req: any) {
    const conv = await this.conversationsService.findById(id);
    if (!conv) return null;
    
    const userId = req.user?.id;
    if (conv.userId.startsWith('guest-') && !userId) {
      return conv; // Allow guest to view their current session if they have the ID
    }
    if (conv.userId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }
    return conv;
  }

  @Post()
  create(@Req() req: any, @Body() createConversationDto: CreateConversationDto) {
    const userId = req.user?.id || `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Override the DTO's userId with the authenticated one or the guest one
    return this.conversationsService.create({ ...createConversationDto, userId });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateConversationDto: UpdateConversationDto, @Req() req: any) {
    await this.checkOwnership(id, req.user?.id);
    return this.conversationsService.update(id, updateConversationDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    await this.checkOwnership(id, req.user?.id);
    return this.conversationsService.delete(id);
  }

  private async checkOwnership(id: string, userId: string | undefined) {
    // Mutations require an authenticated owner. Guest-ID knowledge alone
    // is not sufficient to rename or delete a conversation.
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    const conv = await this.conversationsService.findById(id);
    if (conv.userId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }
  }
}
