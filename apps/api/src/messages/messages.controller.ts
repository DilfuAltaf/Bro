import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Response } from 'express';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { AuthGuard } from '../auth/optional-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('conversations/:id/messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private async checkOwnership(conversationId: string, userId: string | undefined) {
    const { data: conv, error } = await this.supabaseService.client
      .from('ConversationThread')
      .select('userId')
      .eq('id', conversationId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(
        'Unable to verify conversation access. Please try again later.',
      );
    }
    if (!conv) throw new NotFoundException('Conversation not found');

    if (conv.userId.startsWith('guest-') && !userId) {
      return; // Allow guests to post to guest conversations
    }
    if (conv.userId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }
  }

  @Get()
  async getMessages(@Param('id') conversationId: string, @Req() req: any) {
    await this.checkOwnership(conversationId, req.user?.id);
    return this.messagesService.getMessages(conversationId);
  }

  @Post()
  async sendMessage(@Param('id') conversationId: string, @Body() dto: SendMessageDto, @Req() req: any) {
    await this.checkOwnership(conversationId, req.user?.id);
    return this.messagesService.sendMessage(conversationId, dto.content, dto.mode, dto.model, dto.images);
  }

  /**
   * Server-Sent Events stream. Emits `{"type":"token","value":"..."}` per delta,
   * then a final `{"type":"done",...}`. The web client consumes this with fetch +
   * ReadableStream (EventSource cannot POST).
   */
  @Post('stream')
  async streamMessage(
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    await this.checkOwnership(conversationId, req.user?.id);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      for await (const event of this.messagesService.streamMessage(
        conversationId,
        dto.content,
        dto.mode,
        dto.model,
        dto.images,
      )) {
        send(event);
      }
    } catch (error: any) {
      send({ type: 'error', message: error?.message || 'Terjadi kesalahan.' });
    } finally {
      res.end();
    }
  }

  @Post('sync')
  async syncMessage(
    @Param('id') conversationId: string,
    @Body() body: { role: string; content: string },
    @Req() req: any,
  ) {
    await this.checkOwnership(conversationId, req.user?.id);
    return this.messagesService.syncMessage(conversationId, body.role, body.content);
  }
}
