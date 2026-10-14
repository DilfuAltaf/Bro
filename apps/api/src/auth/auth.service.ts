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
import { normalizeLanguage, normalizePurpose } from '../gemini/gemini.service';
import * as crypto from 'crypto';

const USER_SELECT_FULL = 'id, email, name, language, purpose, createdAt';
const USER_SELECT_WITH_LANG = 'id, email, name, language, createdAt';
const USER_SELECT_BASIC = 'id, email, name, createdAt';

/** True bila error = kolom belum ada (migrasi belum jalan). */
function isMissingColumn(error: any): boolean {
  return !!error && (error.code === '42703' || /language|purpose/i.test(error.message || ''));
}

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
    const language = normalizeLanguage(data?.language);
    const purpose = normalizePurpose(data?.purpose);
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

    // Insert dengan kolom language+purpose; fallback bertahap bila migrasi
    // DB belum dijalankan agar register tetap jalan.
    let user: any = null;
    const full = await this.supabaseService.client
      .from('User')
      .insert({
        id,
        email,
        name: name || null,
        passwordHash,
        language,
        purpose,
      })
      .select('id, email, name, language, purpose')
      .single();

    if (!full.error) {
      user = full.data;
    } else {
      if (full.error.code === '23505') {
        throw new ConflictException('Email already in use');
      }
      if (isMissingColumn(full.error)) {
        this.logger.warn('User.language/purpose column missing, retrying with fewer columns. Run pending migrations in scripts/.');
        // Coba tanpa purpose dulu (migrasi language saja yang sudah jalan).
        const noPurpose = await this.supabaseService.client
          .from('User')
          .insert({ id, email, name: name || null, passwordHash, language })
          .select('id, email, name, language')
          .single();
        if (!noPurpose.error) {
          user = { ...noPurpose.data, purpose };
        } else if (noPurpose.error.code === '23505') {
          throw new ConflictException('Email already in use');
        } else if (isMissingColumn(noPurpose.error)) {
          const retry = await this.supabaseService.client
            .from('User')
            .insert({ id, email, name: name || null, passwordHash })
            .select('id, email, name')
            .single();
          if (retry.error) {
            if (retry.error.code === '23505') throw new ConflictException('Email already in use');
            this.logDbError('register user insert', retry.error);
            throw new InternalServerErrorException('Unable to create account. Please try again later.');
          }
          user = { ...retry.data, language, purpose };
        } else {
          this.logDbError('register user insert', noPurpose.error);
          throw new InternalServerErrorException('Unable to create account. Please try again later.');
        }
      } else {
        this.logDbError('register user insert', full.error);
        throw new InternalServerErrorException(
          'Unable to create account. Please try again later.',
        );
      }
    }

    const token = this.generateToken(user.id);
    return {
      user: { id: user.id, email: user.email, name: user.name, language: normalizeLanguage(user.language), purpose: normalizePurpose(user.purpose) },
      token,
    };
  }

  async login(data: any) {
    const { email, password } = data;
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    let user: any = null;
    const full = await this.supabaseService.client
      .from('User')
      .select('id, email, name, language, purpose, passwordHash')
      .eq('email', email)
      .maybeSingle();

    if (!full.error) {
      user = full.data;
    } else if (isMissingColumn(full.error)) {
      // Fallback bertahap: tanpa purpose, lalu tanpa language.
      const noPurpose = await this.supabaseService.client
        .from('User')
        .select('id, email, name, language, passwordHash')
        .eq('email', email)
        .maybeSingle();
      if (!noPurpose.error) {
        user = { ...noPurpose.data, purpose: null };
      } else if (isMissingColumn(noPurpose.error)) {
        const fallback = await this.supabaseService.client
          .from('User')
          .select('id, email, name, passwordHash')
          .eq('email', email)
          .maybeSingle();
        if (fallback.error) {
          this.logDbError('login user lookup', fallback.error);
          throw new InternalServerErrorException('Unable to authenticate. Please try again later.');
        }
        user = { ...fallback.data, language: 'en', purpose: null };
      } else {
        this.logDbError('login user lookup', noPurpose.error);
        throw new InternalServerErrorException('Unable to authenticate. Please try again later.');
      }
    } else {
      this.logDbError('login user lookup', full.error);
      throw new InternalServerErrorException('Unable to authenticate. Please try again later.');
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
      user: { id: user.id, email: user.email, name: user.name, language: normalizeLanguage(user.language), purpose: normalizePurpose(user.purpose) },
      token,
    };
  }

  async getMe(userId: string) {
    const full = await this.supabaseService.client
      .from('User')
      .select(USER_SELECT_FULL)
      .eq('id', userId)
      .maybeSingle();

    let user: any = full.data;
    if (full.error) {
      if (isMissingColumn(full.error)) {
        const withLang = await this.supabaseService.client
          .from('User')
          .select(USER_SELECT_WITH_LANG)
          .eq('id', userId)
          .maybeSingle();
        if (!withLang.error) {
          user = { ...withLang.data, purpose: null };
        } else if (isMissingColumn(withLang.error)) {
          const fallback = await this.supabaseService.client
            .from('User')
            .select(USER_SELECT_BASIC)
            .eq('id', userId)
            .maybeSingle();
          if (fallback.error) {
            this.logDbError('getMe user lookup', fallback.error);
            throw new InternalServerErrorException('Unable to retrieve user. Please try again later.');
          }
          user = { ...fallback.data, language: 'en', purpose: null };
        } else {
          this.logDbError('getMe user lookup', withLang.error);
          throw new InternalServerErrorException('Unable to retrieve user. Please try again later.');
        }
      } else {
        this.logDbError('getMe user lookup', full.error);
        throw new InternalServerErrorException('Unable to retrieve user. Please try again later.');
      }
    }
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      language: normalizeLanguage(user.language),
      purpose: normalizePurpose(user.purpose),
      createdAt: user.createdAt,
    };
  }

  async updateMe(userId: string, data: any) {
    const hasName = typeof data?.name === 'string';
    const hasLang = data?.language !== undefined;
    const hasPurpose = data?.purpose !== undefined;
    if (!hasName && !hasLang && !hasPurpose) {
      throw new BadRequestException('Nothing to update.');
    }

    const payload: Record<string, unknown> = {};
    if (hasName) {
      const name = (data.name as string).trim();
      if (!name) throw new BadRequestException('Name must not be empty.');
      if (name.length > 50) throw new BadRequestException('Name must be at most 50 characters.');
      payload.name = name;
    }
    if (hasLang) {
      payload.language = normalizeLanguage(data.language);
    }
    if (hasPurpose) {
      const purpose = normalizePurpose(data.purpose);
      if (!purpose) throw new BadRequestException('Invalid purpose.');
      payload.purpose = purpose;
    }

    // Coba update full; fallback bertahap bila kolom belum ada.
    const attempt = async (body: Record<string, unknown>, select: string) =>
      this.supabaseService.client.from('User').update(body).eq('id', userId).select(select).single();

    let res = await attempt(payload, 'id, email, name, language, purpose, createdAt');
    if (res.error && isMissingColumn(res.error)) {
      this.logger.warn('User.language/purpose column missing on updateMe, retrying with fewer columns.');
      const { purpose: _dropP, ...noPurpose } = payload;
      void _dropP;
      res = await attempt(noPurpose, 'id, email, name, language, createdAt');
      if (res.error && isMissingColumn(res.error)) {
        const { language: _dropL, ...rest } = noPurpose;
        void _dropL;
        if (Object.keys(rest).length === 0) {
          // Hanya ganti bahasa/purpose tapi kolom belum ada → anggap sukses (disimpan client-side).
          const current = await this.getMe(userId).catch(() => null);
          return {
            ...(current || { id: userId }),
            language: normalizeLanguage((payload as any).language),
            purpose: normalizePurpose((payload as any).purpose),
          };
        }
        res = await attempt(rest, 'id, email, name, createdAt');
      } else if (!res.error && hasPurpose) {
        // Kolom purpose belum ada tapi update lain sukses → kembalikan purpose dari request.
        const user: any = res.data;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          language: normalizeLanguage(user.language ?? (payload as any).language),
          purpose: normalizePurpose((payload as any).purpose),
          createdAt: user.createdAt,
        };
      }
    }

    if (res.error) {
      this.logDbError('updateMe user update', res.error);
      throw new InternalServerErrorException('Unable to update profile. Please try again later.');
    }
    const user: any = res.data;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      language: normalizeLanguage(user.language ?? (payload as any).language),
      purpose: normalizePurpose(user.purpose ?? (payload as any).purpose),
      createdAt: user.createdAt,
    };
  }

  async changePassword(userId: string, data: any) {
    const currentPassword = data?.currentPassword;
    const newPassword = data?.newPassword;
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Current and new password are required.');
    }
    if (newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters.');
    }
    if (newPassword.length > 72) {
      throw new BadRequestException('New password must be at most 72 characters.');
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
      throw new BadRequestException('Guest accounts do not have a password.');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect.');
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
