import { Controller, Get } from '@nestjs/common';
import { GeminiService } from './gemini.service';

@Controller('gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  /** Diagnostic only. Reports the configured model and reachability. */
  @Get('health')
  async health() {
    return this.geminiService.checkHealth();
  }

  /** Daftar model yang bisa dipilih user (Gemini + Groq). */
  @Get('models')
  async models() {
    return this.geminiService.listModels();
  }
}
