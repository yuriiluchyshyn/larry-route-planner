/**
 * Proxy Client - Простий клієнт для проксування запитів
 * Тільки проксує дані, не формує запити
 */

export interface ProxyResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export class ProxyClient {
  private baseUrl: string;

  constructor(proxyPort: number = 8848) {
    this.baseUrl = `http://localhost:${proxyPort}`;
  }

  /**
   * Перевірити доступність проксі-сервера
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      return response.ok;
    } catch (error) {
      console.error('❌ Проксі-сервер недоступний:', error);
      return false;
    }
  }

  /**
   * Проксувати готовий запит (тільки проксування, без формування)
   */
  async makeRequest(
    endpoint: string, 
    params: Record<string, any>, 
    method: string = 'GET',
    targetBaseUrl?: string
  ): Promise<ProxyResponse> {
    try {
      // Визначаємо правильний базовый URL для різних ендпоінтів
      let fullUrl: string;
      
      if (endpoint.startsWith('/app/geocoder-api')) {
        // Для геокодера використовуємо спеціальний маршрут
        fullUrl = `${this.baseUrl}${endpoint}`;
      } else if (endpoint.startsWith('/app/exchange/api/rest/v2')) {
        // Для freight-offers використовуємо прямий маршрут без додавання /api/trans
        fullUrl = `${this.baseUrl}${endpoint}`;
      } else {
        // Загальний випадок
        fullUrl = `${this.baseUrl}/api/trans${endpoint}`;
      }

      const url = new URL(fullUrl);
      
      // Додаємо параметри до URL
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });

      // Якщо вказано інший базовий URL, додаємо його як параметр
      if (targetBaseUrl) {
        url.searchParams.append('_target_base_url', targetBaseUrl);
      }

      console.log('🔧 ProxyClient - проксуємо запит:', url.toString());

      const response = await fetch(url.toString(), {
        method: method.toUpperCase(),
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error:', response.status, response.statusText, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        data,
        status: response.status
      };

    } catch (error) {
      console.error('❌ Помилка проксування:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Створити простий проксі клієнт
 */
export function createProxyClient(proxyPort?: number): ProxyClient {
  return new ProxyClient(proxyPort);
}