import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
export declare class ConversationsService {
    private prisma;
    constructor(prisma: PrismaService);
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
    create(data: CreateConversationDto): import("@prisma/client").Prisma.Prisma__ConversationThreadClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        title: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, data: UpdateConversationDto): import("@prisma/client").Prisma.Prisma__ConversationThreadClient<{
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
//# sourceMappingURL=conversations.service.d.ts.map