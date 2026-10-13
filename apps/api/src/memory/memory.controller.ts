import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { AuthGuard } from '../auth/optional-auth.guard';

@Controller('memory')
@UseGuards(AuthGuard)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  private requireUserId(req: any): string {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    return userId;
  }

  @Get()
  findByUser(@Req() req: any) {
    // Identity always comes from the verified JWT, never a client-supplied userId.
    return this.memoryService.findByUser(this.requireUserId(req));
  }

  @Post()
  create(@Req() req: any, @Body() data: { userId?: string; content: string; type?: string }) {
    // Caller-supplied userId is ignored; the owner is the authenticated caller.
    return this.memoryService.create({ content: data.content, type: data.type, userId: this.requireUserId(req) });
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    const userId = this.requireUserId(req);
    const existing = await this.memoryService.findById(id);
    if (!existing) throw new NotFoundException('Memory not found');
    if (existing.userId !== userId) throw new ForbiddenException('You do not have access to this memory');
    return this.memoryService.delete(id);
  }

  @Delete()
  deleteAllByUser(@Req() req: any) {
    // Bulk delete is scoped to the authenticated caller only.
    return this.memoryService.deleteAllByUser(this.requireUserId(req));
  }
}
