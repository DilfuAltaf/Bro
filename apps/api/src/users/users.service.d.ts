import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        name: string | null;
        email: string;
        id: string;
        image: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findById(id: string): Promise<{
        name: string | null;
        email: string;
        id: string;
        image: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(data: CreateUserDto): import("@prisma/client").Prisma.Prisma__UserClient<{
        name: string | null;
        email: string;
        id: string;
        image: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, data: UpdateUserDto): import("@prisma/client").Prisma.Prisma__UserClient<{
        name: string | null;
        email: string;
        id: string;
        image: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
//# sourceMappingURL=users.service.d.ts.map