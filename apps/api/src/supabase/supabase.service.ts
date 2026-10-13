import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConnectionStatus {
  configured: boolean;
  connected: boolean;
  message: string;
}

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private _client: SupabaseClient | null = null;
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly anonKey: string;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = (this.configService.get<string>('SUPABASE_URL') || '').trim();
    this.serviceRoleKey = (this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    this.anonKey = (this.configService.get<string>('SUPABASE_ANON_KEY') || '').trim();

    if (this.supabaseUrl && this.serviceRoleKey) {
      try {
        this._client = createClient(this.supabaseUrl, this.serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });
        this.logger.log(`Supabase service client initialized for: ${this.supabaseUrl}`);
      } catch (err: any) {
        this.logger.error(`Failed to initialize Supabase client: ${err?.message || err}`);
      }
    } else {
      this.logger.warn(
        'Supabase client not initialized: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.',
      );
    }
  }

  onModuleInit() {
    if (!this.supabaseUrl) {
      this.logger.warn('SUPABASE_URL is not configured.');
    }
    if (!this.serviceRoleKey) {
      this.logger.warn('SUPABASE_SERVICE_ROLE_KEY is not configured; backend queries requiring elevated privileges will fail.');
    }
  }

  /**
   * Primary client for server-side database operations.
   */
  get client(): SupabaseClient {
    if (!this._client) {
      throw new Error(
        'Supabase client is not configured. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.',
      );
    }
    return this._client;
  }

  /**
   * Check if Supabase credentials are configured and endpoint is reachable.
   */
  async checkConnection(): Promise<SupabaseConnectionStatus> {
    if (!this.supabaseUrl || (!this.serviceRoleKey && !this.anonKey)) {
      return {
        configured: false,
        connected: false,
        message: 'Credentials missing: SUPABASE_URL or keys are not set in .env',
      };
    }

    if (!this._client) {
      return {
        configured: true,
        connected: false,
        message: 'Supabase client failed to initialize',
      };
    }

    try {
      // Test basic connectivity via the Supabase REST endpoint without assuming tables exist
      const res = await fetch(`${this.supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: this.serviceRoleKey || this.anonKey,
          Authorization: `Bearer ${this.serviceRoleKey || this.anonKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok || res.status === 200 || res.status === 404) {
        // HTTP 200 or 404 (root endpoint response from PostgREST) confirms reachable project
        return {
          configured: true,
          connected: true,
          message: `Successfully connected to Supabase endpoint (${res.status})`,
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          configured: true,
          connected: false,
          message: `Authentication failed (HTTP ${res.status}): Invalid API key`,
        };
      }

      return {
        configured: true,
        connected: false,
        message: `Unexpected response from Supabase endpoint: HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        message: `Connection error: ${err?.message || err}`,
      };
    }
  }
}
