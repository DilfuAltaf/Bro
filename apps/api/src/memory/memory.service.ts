import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MemoryService {
  constructor(private prisma: PrismaService) {}

  findByUser(userId: string) {
    return this.prisma.memory.findMany({ where: { userId } });
  }

  create(data: { userId: string; content: string; type?: string }) {
    return this.prisma.memory.create({ data });
  }

  delete(id: string) {
    return this.prisma.memory.delete({ where: { id } });
  }

  deleteAllByUser(userId: string) {
    return this.prisma.memory.deleteMany({ where: { userId } });
  }
}
