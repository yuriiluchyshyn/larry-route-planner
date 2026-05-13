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
  private authToken?: string;

  constructor(proxyPort: number = 8848, authToken?: string) {
    this.baseUrl = `http://localhost:${proxyPort}`;
    this.authToken = authToken;
  }

  /**
   * Встановити токен автентифікації
   */
  setAuthToken(token: string): void {
    this.authToken = token;
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
      // Визначаємо правильний URL для проксування
      let fullUrl: string;
      
      // Якщо endpoint вже містить повний шлях, використовуємо його як є
      if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        fullUrl = endpoint;
      } else {
        // Інакше будуємо URL через проксі, додаючи /api префікс
        const apiEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
        fullUrl = `${this.baseUrl}${apiEndpoint}`;
      }

      const url = new URL(fullUrl);
      
      // Додаємо параметри до URL
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Для JSON параметрів (filter, sort, counters) використовуємо set замість append
          // щоб уникнути подвійного кодування
          if (key === 'filter' || key === 'sort' || key === 'counters') {
            // Перевіряємо чи це вже JSON string
            const stringValue = String(value);
            try {
              // Якщо це валідний JSON, використовуємо його як є
              JSON.parse(stringValue);
              url.searchParams.set(key, stringValue);
            } catch {
              // Якщо це не JSON, додаємо як звичайний параметр
              url.searchParams.set(key, stringValue);
            }
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      });

      // Якщо вказано інший базовий URL, додаємо його як параметр
      if (targetBaseUrl) {
        url.searchParams.append('_target_base_url', targetBaseUrl);
      }

      console.log('🔧 ProxyClient - проксуємо запит:', url.toString());

      // Формуємо заголовки
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,uk;q=0.8,pl;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };

      // Додаємо токен автентифікації якщо є
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
        console.log('🔑 Додано Authorization header з JWT токеном');
      }

      const response = await fetch(url.toString(), {
        method: method.toUpperCase(),
        headers,
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
export function createProxyClient(proxyPort?: number, authToken?: string): ProxyClient {
  return new ProxyClient(proxyPort, authToken);
}