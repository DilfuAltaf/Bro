import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    const secret = (this.configService.get<string>('AUTH_SECRET') || '').trim();
    if (!secret) {
      throw new Error(
        'AUTH_SECRET is missing or empty. Set a strong random value (at least 32 characters) in .env before starting the API.',
      );
    }
    this.jwtSecret = secret;
  }

  private logDbError(context: string, error: any) {
    // Log only safe diagnostic fields. Never log passwords, hashes, tokens, or secrets.
    this.logger.error(
      `${context} failed: code=${error?.code || 'unknown'} message=${error?.message || error} details=${error?.details || 'n/a'} hint=${error?.hint || 'n/a'}`,
    );
  }

  async register(data: any) {
    const { email, password, name } = data;
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }
    if (password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const { data: existingUser, error: checkError } =
      await this.supabaseService.client
        .from('User')
        .select('id')
        .eq('email', email)
        .maybeSingle();

    if (checkError) {
      this.logDbError('register email availability check', checkError);
      throw new InternalServerErrorException(
        'Unable to verify email availability. Please try again later.',
      );
    }
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = data.id || crypto.randomUUID();

    const { data: user, error: insertError } =
      await this.supabaseService.client
        .from('User')
        .insert({
          id,
          email,
          name: name || null,
          passwordHash,
        })
        .select('id, email, name')
        .single();

    if (insertError) {
      if (insertError.code === '23505') {
        throw new ConflictException('Email already in use');
      }
      this.logDbError('register user insert', insertError);
      throw new InternalServerErrorException(
        'Unable to create account. Please try again later.',
      );
    }

    const token = this.generateToken(user.id);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      token,
    };
  }

  async login(data: any) {
    const { email, password } = data;
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const { data: user, error: fetchError } =
      await this.supabaseService.client
        .from('User')
        .select('id, email, name, passwordHash')
        .eq('email', email)
        .maybeSingle();

    if (fetchError) {
      this.logDbError('login user lookup', fetchError);
      throw new InternalServerErrorException(
        'Unable to authenticate. Please try again later.',
      );
    }
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user.id);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      token,
    };
  }

  async getMe(userId: string) {
    const { data: user, error: fetchError } =
      await this.supabaseService.client
        .from('User')
        .select('id, email, name, createdAt')
        .eq('id', userId)
        .maybeSingle();

    if (fetchError) {
      this.logDbError('getMe user lookup', fetchError);
      throw new InternalServerErrorException(
        'Unable to retrieve user. Please try again later.',
      );
    }
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }

  async updateMe(userId: string, data: any) {
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    if (!name) {
      throw new BadRequestException('Nama tidak boleh kosong.');
    }
    if (name.length > 50) {
      throw new BadRequestException('Nama maksimal 50 karakter.');
    }

    const { data: user, error: updateError } =
      await this.supabaseService.client
        .from('User')
        .update({ name })
        .eq('id', userId)
        .select('id, email, name, createdAt')
        .single();

    if (updateError) {
      this.logDbError('updateMe user update', updateError);
      throw new InternalServerErrorException(
        'Unable to update profile. Please try again later.',
      );
    }
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }

  async changePassword(userId: string, data: any) {
    const currentPassword = data?.currentPassword;
    const newPassword = data?.newPassword;
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Password lama dan baru wajib diisi.');
    }
    if (newPassword.length < 6) {
      throw new BadRequestException('Password baru minimal 6 karakter.');
    }
    if (newPassword.length > 72) {
      throw new BadRequestException('Password baru maksimal 72 karakter.');
    }

    const { data: user, error: fetchError } =
      await this.supabaseService.client
        .from('User')
        .select('id, passwordHash')
        .eq('id', userId)
        .maybeSingle();

    if (fetchError) {
      this.logDbError('changePassword user lookup', fetchError);
      throw new InternalServerErrorException(
        'Unable to change password. Please try again later.',
      );
    }
    if (!user || !user.passwordHash) {
      throw new BadRequestException('Akun guest tidak memiliki password.');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Password lama salah.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await this.supabaseService.client
      .from('User')
      .update({ passwordHash })
      .eq('id', userId);

    if (updateError) {
      this.logDbError('changePassword user update', updateError);
      throw new InternalServerErrorException(
        'Unable to change password. Please try again later.',
      );
    }
    return { success: true };
  }

  async getStats(userId: string) {
    const { data: threads, error: threadError } =
      await this.supabaseService.client
        .from('ConversationThread')
        .select('id')
        .eq('userId', userId);

    if (threadError) {
      this.logDbError('getStats thread lookup', threadError);
      throw new InternalServerErrorException(
        'Unable to retrieve stats. Please try again later.',
      );
    }
    const threadIds = (threads || []).map((t: any) => t.id);

    let messageCount = 0;
    if (threadIds.length > 0) {
      const { count, error: msgError } = await this.supabaseService.client
        .from('Message')
        .select('id', { count: 'exact', head: true })
        .in('conversationId', threadIds);
      if (msgError) {
        this.logDbError('getStats message count', msgError);
        throw new InternalServerErrorException(
          'Unable to retrieve stats. Please try again later.',
        );
      }
      messageCount = count || 0;
    }

    const { data: user, error: userError } =
      await this.supabaseService.client
        .from('User')
        .select('createdAt')
        .eq('id', userId)
        .maybeSingle();

    if (userError) {
      this.logDbError('getStats user lookup', userError);
      throw new InternalServerErrorException(
        'Unable to retrieve stats. Please try again later.',
      );
    }

    return {
      memberSince: user?.createdAt || null,
      conversations: threadIds.length,
      messages: messageCount,
    };
  }

  async deleteAccount(userId: string) {
    // Thread + pesan ikut terhapus via ON DELETE CASCADE di database.
    const { error: deleteError } = await this.supabaseService.client
      .from('User')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      this.logDbError('deleteAccount user delete', deleteError);
      throw new InternalServerErrorException(
        'Unable to delete account. Please try again later.',
      );
    }
    return { success: true };
  }

  private generateToken(userId: string) {
    return jwt.sign({ userId }, this.jwtSecret, { expiresIn: '7d' });
  }

  verifyToken(token: string) {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as any;
      return payload.userId;
    } catch (e) {
      return null;
    }
  }
}
