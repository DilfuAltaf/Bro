import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('conversations/:id/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  getMessages(@Param('id') conversationId: string) {
    return this.messagesService.getMessages(conversationId);
  }

  @Post()
  sendMessage(@Param('id') conversationId: string, @Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(conversationId, dto.content);
  }
}
