/**
 * Token Service
 * Сервіс для роботи з JWT токенами
 */

/**
 * Отримати токен з URL параметрів
 */
export function getTokenFromUrl(): string {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken && urlToken.length > 20) {
      console.log('Larry: Token found in URL parameters');
      return urlToken;
    }
    return '';
  } catch (error) {
    console.warn('Failed to read token from URL:', error);
    return '';
  }
}

/**
 * Отримати bearer token з extension або localStorage
 */
export function getBearerTokenFromStorage(): string {
  try {
    console.log('Larry: Searching for authentication tokens...');
    
    // Пріоритетні ключі для токенів (на основі platform.trans.eu)
    const priorityKeys = [
      'transFrameTokenExpireAt', // Основний токен з терміном дії
      'transFrameToken',         // Запасний токен
      'larryAuthToken',          // Наш збережений токен
      'authToken',
      'accessToken',
      'bearerToken'
    ];
    
    // Перевіряємо пріоритетні ключі
    for (const key of priorityKeys) {
      const token = localStorage.getItem(key);
      if (token && token.length > 20) {
        console.log(`Larry: Token found in localStorage with key "${key}"`);
        
        // Перевіряємо чи це JWT токен
        const isJWT = token.includes('.') && token.split('.').length === 3;
        if (isJWT) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const isExpired = payload.exp ? Date.now() > (payload.exp * 1000) : false;
            if (!isExpired) {
              console.log(`Larry: Using valid JWT token from "${key}"`);
              return token;
            } else {
              console.log(`Larry: JWT token from "${key}" is expired`);
            }
          } catch (e) {
            console.log(`Larry: Using non-JWT token from "${key}"`);
            return token;
          }
        } else {
          console.log(`Larry: Using non-JWT token from "${key}"`);
          return token;
        }
      }
    }
    
    console.log('Larry: No valid token found in localStorage');
    return '';
  } catch (error) {
    console.warn('Failed to read token:', error);
    return '';
  }
}

/**
 * Відправити токен до проксі-сервера
 */
export async function sendTokenToProxy(token: string): Promise<void> {
  if (!token) {
    console.warn('Larry: No token provided to sendTokenToProxy');
    return;
  }
  
  try {
    // Зберігаємо токен в localStorage для використання в proxyClient
    localStorage.setItem('larryAuthToken', token);
    console.log('Larry: Token saved to localStorage for proxyClient');
    
    // Додаткове логування для діагностики
    console.log('Larry: Sending token to proxy server...');
    console.log('Larry: Token length:', token.length);
    console.log('Larry: Token starts with:', token.substring(0, 20) + '...');
    
    // Перевіряємо чи це JWT токен
    const isJWT = token.includes('.') && token.split('.').length === 3;
    console.log('Larry: Is JWT format:', isJWT);
    
    if (isJWT) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Larry: JWT payload exp:', payload.exp ? new Date(payload.exp * 1000).toISOString() : 'no expiry');
        console.log('Larry: JWT payload iss:', payload.iss || 'no issuer');
      } catch (e) {
        console.warn('Larry: Could not decode JWT payload:', e);
      }
    }
    
    const response = await fetch('http://localhost:8848/set-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Larry: Token successfully sent to proxy:', result);
    } else {
      const errorText = await response.text();
      console.error('Larry: Failed to send token to proxy:', response.status, errorText);
    }
  } catch (error) {
    console.error('Larry: Error sending token to proxy:', error);
  }
}

/**
 * Очистити токен з localStorage та проксі-сервера
 */
export async function clearToken(): Promise<void> {
  try {
    // Очищуємо з localStorage
    localStorage.removeItem('larryAuthToken');
    localStorage.removeItem('transFrameToken');
    localStorage.removeItem('bearerToken');
    
    console.log('Larry: Tokens cleared from localStorage');
    
    // Можна також очистити токен на проксі-сервері
    // await fetch('/clear-token', { method: 'POST' });
  } catch (error) {
    console.error('Larry: Error clearing tokens:', error);
  }
}

/**
 * Перевірити чи є валідний токен
 */
export function hasValidToken(): boolean {
  try {
    const token = localStorage.getItem('larryAuthToken') || 
                 localStorage.getItem('transFrameToken') ||
                 localStorage.getItem('bearerToken');
    
    if (!token) return false;
    
    // Якщо це JWT токен, перевіряємо термін дії
    if (token.includes('.') && token.split('.').length === 3) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp) {
          const expiryTime = payload.exp * 1000; // JWT exp в секундах
          const currentTime = Date.now();
          return currentTime < expiryTime;
        }
      } catch (e) {
        console.warn('Larry: Could not decode JWT for validation:', e);
      }
    }
    
    // Якщо не JWT або немає exp, вважаємо валідним якщо є
    return true;
  } catch (error) {
    console.error('Larry: Error checking token validity:', error);
    return false;
  }
}