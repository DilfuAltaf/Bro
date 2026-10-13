import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

const MEMORY_SELECT = 'id, userId, content, type, createdAt, updatedAt';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private logDbError(context: string, error: any) {
    // Log only safe diagnostic fields. Never log memory content or secrets.
    this.logger.error(
      `${context} failed: code=${error?.code || 'unknown'} message=${error?.message || error} details=${error?.details || 'n/a'} hint=${error?.hint || 'n/a'}`,
    );
  }

  private throwDbError(context: string, error: any, message: string): never {
    this.logDbError(context, error);
    throw new InternalServerErrorException(message);
  }

  async findByUser(userId: string) {
    const { data, error } = await this.supabaseService.client
      .from('Memory')
      .select(MEMORY_SELECT)
      .eq('userId', userId);

    if (error) {
      this.throwDbError(
        'findByUser memories',
        error,
        'Unable to retrieve memories. Please try again later.',
      );
    }
    return data || [];
  }

  async findById(id: string) {
    const { data, error } = await this.supabaseService.client
      .from('Memory')
      .select(MEMORY_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.throwDbError(
        'findById memory',
        error,
        'Unable to retrieve memory. Please try again later.',
      );
    }
    return data || null;
  }

  async create(data: { userId: string; content: string; type?: string }) {
    const { data: memory, error } = await this.supabaseService.client
      .from('Memory')
      .insert({
        id: crypto.randomUUID(),
        userId: data.userId,
        content: data.content,
        ...(data.type !== undefined ? { type: data.type } : {}),
      })
      .select(MEMORY_SELECT)
      .single();

    if (error) {
      this.throwDbError(
        'create memory',
        error,
        'Unable to save memory. Please try again later.',
      );
    }
    return memory;
  }

  async delete(id: string) {
    const { data: deleted, error } = await this.supabaseService.client
      .from('Memory')
      .delete()
      .eq('id', id)
      .select(MEMORY_SELECT)
      .single();

    if (error) {
      // No row matched the id — preserve the previous NotFound behavior.
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Memory not found');
      }
      this.throwDbError(
        'delete memory',
        error,
        'Unable to delete memory. Please try again later.',
      );
    }
    return deleted;
  }

  async deleteAllByUser(userId: string) {
    const { error } = await this.supabaseService.client
      .from('Memory')
      .delete()
      .eq('userId', userId);

    if (error) {
      this.throwDbError(
        'deleteAllByUser memories',
        error,
        'Unable to delete memories. Please try again later.',
      );
    }
    return { success: true };
  }
}
