import { Injectable } from '@nestjs/common';

@Injectable()
export class SafetyService {
  private readonly crisisKeywords = [
    'bunuh diri',
    'mengakhiri hidup',
    'depresi berat',
    'menyakiti diri',
    'tidak ingin hidup',
    'mati saja',
  ];

  checkSafety(content: string): { isCrisis: boolean; response?: string } {
    const lowerContent = content.toLowerCase();
    for (const word of this.crisisKeywords) {
      if (lowerContent.includes(word)) {
        return {
          isCrisis: true,
          response:
            'Saya melihat Anda sedang mengalami masa yang sangat sulit. Keselamatan Anda sangat berharga. Jika Anda sedang mengalami krisis, mohon segera cari bantuan profesional atau hubungi layanan darurat (seperti 119 di Indonesia) atau orang terdekat yang Anda percayai.',
        };
      }
    }
    return { isCrisis: false };
  }
}
