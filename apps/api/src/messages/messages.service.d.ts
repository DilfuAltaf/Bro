import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
export declare class MessagesService {
    private readonly prisma;
    private readonly config;
    constructor(prisma: PrismaService, config: ConfigService);
    getMessages(conversationId: string): Promise<{
        id: string;
        createdAt: Date;
        conversationId: string;
        role: string;
        content: string | null;
    }[]>;
    sendMessage(conversationId: string, content: string): Promise<{
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
//# sourceMappingURL=messages.service.d.ts.map