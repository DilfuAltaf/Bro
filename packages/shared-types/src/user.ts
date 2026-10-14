export type AppLanguage = 'en' | 'ar' | 'id' | 'ru' | 'zh' | 'ja' | 'ko';

export type AppPurpose = 'work' | 'study' | 'personal' | 'developer' | 'creator' | 'research';

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  language: AppLanguage;
  purpose: AppPurpose | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  name?: string;
  language?: AppLanguage;
  purpose?: AppPurpose;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  language?: AppLanguage;
  purpose?: AppPurpose;
}
