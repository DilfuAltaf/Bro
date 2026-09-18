import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
export declare class MessagesController {
    private readonly messagesService;
    constructor(messagesService: MessagesService);
    getMessages(conversationId: string): Promise<{
        id: string;
        createdAt: Date;
        conversationId: string;
        role: string;
        content: string | null;
    }[]>;
    sendMessage(conversationId: string, dto: SendMessageDto): Promise<{
        userMessage: {
            id: string;
            createdAt: Date;
            conversationId: string;
            role: string;
            content: string | null;
        };
        assistantMessage: {
            id: string;
            createdAt: Date;
            conversationId: string;
            role: string;
            content: string | null;
        };
        intent: string;
    }>;
}
//# sourceMappingURL=messages.controller.d.ts.map