# Trans.eu API Setup

Інструкції по налаштуванню доступу до Trans.eu API для вирішення 403 Forbidden помилки.

## 🔑 Способи автентифікації

### Варіант 1: JWT Token (найкращий)
JWT токен отримується після успішного логіну на Trans.eu та має обмежений термін дії.

**Переваги:**
- Найвища сумісність з Trans.eu API
- Автоматично включає всі дозволи користувача
- Не потребує додаткових налаштувань

**Отримання:**
1. Увійдіть на [Trans.eu](https://www.trans.eu)
2. Відкрийте Developer Tools (F12)
3. Перейдіть на вкладку Network
4. Зробіть будь-який API запит
5. Знайдіть заголовок `Authorization: Bearer eyJ...`
6. Скопіюйте токен (частину після `Bearer `)

### Варіант 2: API Key
1. Зайдіть на [Trans.eu Developer Portal](https://developers.trans.eu)
2. Зареєструйтесь або увійдіть в акаунт
3. Створіть новий API ключ
4. Скопіюйте ключ

### Варіант 3: OAuth2 Credentials
1. Зайдіть в Trans.eu панель розробника
2. Створіть OAuth2 додаток
3. Отримайте Client ID та Client Secret

## ⚙️ Налаштування змінних середовища

Створіть файл `.env` в корені проекту:

```bash
# JWT Token (найкращий спосіб)
TRANSEU_JWT_TOKEN=your_jwt_token_here

# API ключ (альтернативний спосіб)
TRANSEU_API_KEY=your_api_key_here

# OAuth2 credentials (ще один альтернативний спосіб)
TRANSEU_CLIENT_ID=your_client_id
TRANSEU_CLIENT_SECRET=your_client_secret

# Порт проксі (опціонально)
PROXY_PORT=7740
```

## 🚀 Швидке встановлення JWT токену

### Метод 1: Через URL (найшвидший)
```bash
# Відкрийте в браузері (замініть your_jwt_token на ваш токен)
http://localhost:7740/?token=your_jwt_token_here
```

### Метод 2: Через скрипт
```bash
# Використовуйте наш скрипт
./set-jwt-token.sh 'your_jwt_token_here'

# Або через npm
npm run set-token 'your_jwt_token_here'
```

### Метод 3: Через curl
```bash
curl -X POST http://localhost:7740/set-token \
  -H "Content-Type: application/json" \
  -d '{"token": "your_jwt_token_here"}'
```

## 🚀 Запуск з API ключем

```bash
# Експорт змінних (тимчасово)
export TRANSEU_API_KEY="your_api_key_here"

# Запуск проксі
./start-proxy-only.sh

# Або повний запуск
./run.sh
```

## 🧪 Тестування доступу

### Перевірка статусу проксі:
```bash
curl http://localhost:7740/status
```

### Тест доступу до Trans.eu:
```bash
curl http://localhost:7740/test-transeu
```

### Приклад успішної відповіді:
```json
{
  "status": 200,
  "statusText": "OK",
  "success": true,
  "data": {
    "_embedded": {
      "freight-offers": [...]
    },
    "total": 287
  }
}
```

### Приклад помилки 403:
```json
{
  "status": 403,
  "statusText": "Forbidden",
  "errorBody": "Authentication required",
  "url": "https://api.trans.eu/app/exchange/api/rest/v2/freight-offers?limit=1"
}
```

## 🔧 Альтернативні рішення

### 1. Використання браузерних cookies
Якщо у вас є активна сесія в браузері:

1. Відкрийте Developer Tools (F12)
2. Перейдіть на вкладку Network
3. Зробіть запит до Trans.eu
4. Скопіюйте Cookie заголовок
5. Додайте в проксі:

```javascript
// В proxyServer.js
if (req.headers.cookie) {
  proxyReq.setHeader('Cookie', req.headers.cookie);
}
```

### 2. Використання сесійних токенів
```bash
# Отримання токену через логін
curl -X POST https://api.trans.eu/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'

# Використання токену
export TRANSEU_SESSION_TOKEN="received_token"
```

### 3. IP Whitelisting
Зверніться до Trans.eu підтримки для додавання вашого IP в whitelist.

## 🚨 Вирішення проблем

### 403 Forbidden
```bash
# Перевірте чи встановлені змінні
echo $TRANSEU_API_KEY

# Перевірте статус проксі
curl http://localhost:7740/status

# Тест прямого доступу
curl -H "Authorization: Bearer $TRANSEU_API_KEY" \
  https://api.trans.eu/app/exchange/api/rest/v2/freight-offers?limit=1
```

### 401 Unauthorized
- Перевірте правильність API ключа
- Перевірте чи не закінчився термін дії ключа
- Спробуйте згенерувати новий ключ

### 429 Too Many Requests
- Зменшіть частоту запитів
- Додайте затримки між запитами
- Перевірте rate limits в документації

## 📞 Підтримка

Якщо проблеми залишаються:

1. **Перевірте логи проксі**:
   ```bash
   tail -f src/utils/strategies/new_strategy/proxy/logs/*.log
   ```

2. **Тест без проксі**:
   ```bash
   curl -v -H "Authorization: Bearer $TRANSEU_API_KEY" \
     https://api.trans.eu/app/exchange/api/rest/v2/freight-offers?limit=1
   ```

3. **Зверніться до Trans.eu підтримки**:
   - Email: support@trans.eu
   - Документація: https://developers.trans.eu

## 🔒 Безпека

⚠️ **Важливо**:
- Ніколи не комітьте API ключі в git
- Використовуйте `.env` файли (додайте `.env` в `.gitignore`)
- Регулярно оновлюйте API ключі
- Обмежуйте права доступу ключів