import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ CONFIG HATASI: ${key} .env dosyasında bulunamadı!`);
  }
  return value;
};

export const config = {
  telegram: {
    token: getEnv('TELEGRAM_BOT_TOKEN'),
    adminId: Number(getEnv("ADMIN_ID")) || 0,
  },
  ai: {
    modelName: getEnv('OLLAMA_MODEL') || getEnv('DEFAULT_MODEL'),
    ollamaPort: getEnv('OLLAMA_PORT') || '11434',
  },
  aiSettings: {
    minConfidenceThreshold: Number(getEnv('MIN_CONFIDENCE_THRESHOLD')) || 0.7,
  },
};


