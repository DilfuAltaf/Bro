import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { MemoryModule } from './memory/memory.module';
import { GeminiModule } from './gemini/gemini.module';
import { SafetyModule } from './safety/safety.module';
import { AuthModule } from './auth/auth.module';
import { SupabaseModule } from './supabase/supabase.module';
import { SupabaseService } from './supabase/supabase.service';

@Controller()
class HealthController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health/supabase')
  async supabaseHealth() {
    return this.supabaseService.checkConnection();
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '../../.env'
    }),
    AuthModule,
    ConversationsModule,
    MessagesModule,
    MemoryModule,
    GeminiModule,
    SafetyModule,
    SupabaseModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

