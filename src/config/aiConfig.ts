/**
 * AI Configuration for Larry Route Planner
 * 
 * All AI-related settings in one place.
 * API keys are stored in localStorage (set them here or via UI).
 */

// ============================================================
// AI PROMPT TEMPLATE
// The prompt template is loaded from aiPromptTemplate.md
// ============================================================

// Function to load prompt template from markdown file
async function loadPromptFromMD(): Promise<string> {
  try {
    const response = await fetch('/aiPromptTemplate.md');
    if (!response.ok) {
      throw new Error(`Failed to load prompt template: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Failed to load prompt template from MD file:', error);
    throw new Error('Не вдалося завантажити AI промпт з файлу');
  }
}

// Export async function to get template
export async function getAIPromptTemplate(): Promise<string> {
  return await loadPromptFromMD();
}

// ============================================================
// API KEYS
// Set your API keys here. They will be saved to localStorage.
// Priority: Gemini (free) > Groq (free) > OpenAI > Claude
// ============================================================

const API_KEYS = {
  // 🥇 Google Gemini - FREE, 1M tokens/min, best for large prompts
  // Get key: https://aistudio.google.com/app/apikey
  GEMINI: 'AIzaSyBrCH2zYBbox3_oCAmueEYhyfqyDpac-nA',

  // 🥈 Groq - FREE, 14,400 requests/day, fast but small context
  // Get key: https://console.groq.com
  GROQ: '',

  // OpenAI - ~$0.03 per request
  // Get key: https://platform.openai.com/api-keys
  OPENAI: '',

  // Claude - ~$0.015 per request
  // Get key: https://console.anthropic.com/settings/keys
  CLAUDE: '',
};

// ============================================================
// AI MODEL SETTINGS
// ============================================================

export const AI_MODELS = {
  GEMINI: 'gemini-2.5-pro',
  GROQ: 'llama-3.3-70b-versatile',
  OPENAI: 'gpt-4o',
  CLAUDE: 'claude-3-5-sonnet-20241022',
};

// ============================================================
// AI REQUEST SETTINGS
// ============================================================

export const AI_REQUEST_CONFIG = {
  // Maximum tokens in AI response
  MAX_TOKENS: 32000,

  // Temperature (0-1): lower = more consistent, higher = more creative
  TEMPERATURE: 0.7,

  // Preferred AI service: 'gemini' | 'groq' | 'openai' | 'claude'
  PREFERRED_SERVICE: 'gemini' as 'gemini' | 'groq' | 'openai' | 'claude',
  
  // Debug settings
  SAVE_PROMPTS_TO_FILE: true,
  SAVE_RESPONSES_TO_FILE: true,
};

// ============================================================
// OFFER LIMITS
// ============================================================

export const AI_LIMITS = {
  // Maximum offers to send to AI in one request
  // Gemini 2.5 Pro має 1M context window
  // 1 пропозиція ≈ 250 символів ≈ 80 токенів
  MAX_OFFERS_FOR_AI: 2000,

  // When AI returns 429/context error, reduce to this percentage
  RETRY_REDUCTION_PERCENT: 0.5,

  // Minimum offers to try (won't reduce below this)
  MIN_OFFERS_FOR_RETRY: 100,
};

// ============================================================
// API ENDPOINTS (Vite proxy paths - resolve CORS automatically)
// ============================================================

export const AI_ENDPOINTS = {
  GEMINI: `/api/gemini/v1beta/models/${AI_MODELS.GEMINI}:generateContent`,
  GROQ: '/api/groq/openai/v1/chat/completions',
  OPENAI: '/api/openai/v1/chat/completions',
  CLAUDE: '/api/claude/v1/messages',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Initialize API keys from this config file into localStorage.
 * Keys set here ALWAYS overwrite localStorage values.
 */
export function initializeApiKeys(): void {
  if (typeof window === 'undefined') return;

  const keyMap: Record<string, string> = {
    GEMINI_API_KEY: API_KEYS.GEMINI,
    GROQ_API_KEY: API_KEYS.GROQ,
    OPENAI_API_KEY: API_KEYS.OPENAI,
    CLAUDE_API_KEY: API_KEYS.CLAUDE,
  };

  for (const [storageKey, configValue] of Object.entries(keyMap)) {
    if (configValue) {
      localStorage.setItem(storageKey, configValue);
    }
  }
}

/**
 * Get API key from localStorage
 */
export function getApiKey(service: 'gemini' | 'groq' | 'openai' | 'claude'): string {
  if (typeof window === 'undefined') return '';
  
  const keyMap: Record<string, string> = {
    gemini: 'GEMINI_API_KEY',
    groq: 'GROQ_API_KEY',
    openai: 'OPENAI_API_KEY',
    claude: 'CLAUDE_API_KEY',
  };

  return localStorage.getItem(keyMap[service]) || '';
}

/**
 * Check which AI services are available (have API keys)
 */
export function getAvailableServices(): string[] {
  const services: string[] = [];
  if (getApiKey('gemini')) services.push('gemini');
  if (getApiKey('groq')) services.push('groq');
  if (getApiKey('openai')) services.push('openai');
  if (getApiKey('claude')) services.push('claude');
  return services;
}
