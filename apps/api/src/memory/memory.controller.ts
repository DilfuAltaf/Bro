import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { MemoryService } from './memory.service';

@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  findByUser(@Query('userId') userId: string) {
    return this.memoryService.findByUser(userId);
  }

  @Post()
  create(@Body() data: { userId: string; content: string; type?: string }) {
    return this.memoryService.create(data);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.memoryService.delete(id);
  }

  @Delete()
  deleteAllByUser(@Query('userId') userId: string) {
    return this.memoryService.deleteAllByUser(userId);
  }
}
