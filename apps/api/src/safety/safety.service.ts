import { Injectable } from '@nestjs/common';
import { normalizeLanguage, type AppLanguage } from '../gemini/gemini.service';

const CRISIS_RESPONSES: Record<AppLanguage, string> = {
  en: 'I can see you are going through a very difficult time. Your safety matters. If you are in crisis, please reach out right away to a mental-health professional, local emergency services, or someone you trust.',
  id: 'Saya melihat Anda sedang mengalami masa yang sangat sulit. Keselamatan Anda sangat berharga. Jika Anda sedang mengalami krisis, mohon segera cari bantuan profesional atau hubungi layanan darurat (seperti 119 di Indonesia) atau orang terdekat yang Anda percayai.',
  ar: 'أرى أنك تمر بوقت صعب للغاية. سلامتك مهمة جداً. إذا كنت في أزمة، يرجى التواصل فوراً مع مختص نفسي أو خدمات الطوارئ المحلية أو شخص تثق به.',
  ru: 'Я вижу, что вы переживаете очень тяжёлое время. Ваша безопасность очень важна. Если у вас кризис, пожалуйста, срочно обратитесь к специалисту, в местные экстренные службы или к человеку, которому доверяете.',
  zh: '我能感受到你正在经历非常艰难的时刻。你的安全非常重要。如果你正处于危机中，请立即联系心理健康专业人士、当地急救服务或你信任的人。',
  ja: 'とてもつらい時間を過ごされているのですね。あなたの安全は何より大切です。危機を感じたら、すぐに心の専門家や地域の緊急サービス、信頼できる人に連絡してください。',
  ko: '지금 매우 힘든 시간을 보내고 계신 것 같아요. 당신의 안전이 가장 중요합니다. 위기 상황이라면 즉시 정신건강 전문가나 지역 응급 서비스, 또는 신뢰하는 사람에게 연락하세요.',
};

@Injectable()
export class SafetyService {
  private readonly crisisKeywords = [
    'bunuh diri',
    'mengakhiri hidup',
    'depresi berat',
    'menyakiti diri',
    'tidak ingin hidup',
    'mati saja',
    'suicide',
    'kill myself',
    'self-harm',
    'self harm',
    'end my life',
  ];

  checkSafety(content: string, lang?: string): { isCrisis: boolean; response?: string } {
    const lowerContent = (content || '').toLowerCase();
    for (const word of this.crisisKeywords) {
      if (lowerContent.includes(word)) {
        const L = normalizeLanguage(lang);
        return { isCrisis: true, response: CRISIS_RESPONSES[L] || CRISIS_RESPONSES.en };
      }
    }
    return { isCrisis: false };
  }
}
