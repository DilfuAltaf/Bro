import { PrismaService } from '../prisma/prisma.service';
export declare class MemoryService {
    private prisma;
    constructor(prisma: PrismaService);
    findByUser(userId: string): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        content: string;
        type: string;
    }[]>;
    create(data: {
        userId: string;
        content: string;
        type?: string;
    }): import("@prisma/client").Prisma.Prisma__MemoryClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        content: string;
        type: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    delete(id: string): import("@prisma/client").Prisma.Prisma__MemoryClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        content: string;
        type: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    deleteAllByUser(userId: string): import("@prisma/client").Prisma.PrismaPromise<import("@prisma/client").Prisma.BatchPayload>;
}
//# sourceMappingURL=memory.service.d.ts.map