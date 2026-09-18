import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
export declare class ConversationsController {
    private readonly conversationsService;
    constructor(conversationsService: ConversationsService);
    findAll(userId?: string): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        title: string;
    }[]>;
    findById(id: string): Promise<{
        messages: {
            id: string;
            createdAt: Date;
            conversationId: string;
            role: string;
            content: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        title: string;
    }>;
    create(createConversationDto: CreateConversationDto): import("@prisma/client").Prisma.Prisma__ConversationThreadClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        title: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, updateConversationDto: UpdateConversationDto): import("@prisma/client").Prisma.Prisma__ConversationThreadClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        title: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    delete(id: string): import("@prisma/client").Prisma.Prisma__ConversationThreadClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        title: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
//# sourceMappingURL=conversations.controller.d.ts.map