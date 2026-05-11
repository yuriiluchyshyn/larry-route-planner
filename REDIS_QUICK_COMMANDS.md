# Redis - Короткі команди для швидкої роботи

## 🚀 Запуск Redis

```bash
# macOS (Homebrew)
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 --name redis redis:alpine

# Перевірка підключення
redis-cli ping
# Відповідь: PONG
```

## 🔍 Швидка інспекція кешу

```bash
# Загальна статистика + приклади
npm run redis:inspect

# Тільки статистика
npm run redis:stats

# Очистити весь кеш
npm run redis:clear
```

## 🔎 Пошук маршрутів

```bash
# Пошук всіх маршрутів з Berlin
npm run redis:search Berlin

# Пошук маршрутів Berlin → Warsaw
node inspect-redis.cjs search Berlin Warsaw

# Пошук українських маршрутів
node inspect-redis.cjs search "Київ"
```

## 📊 Статистика та моніторинг

```bash
# Кількість всіх маршрутів
redis-cli EVAL "return #redis.call('keys', 'larry:routes:route:*')" 0

# Розмір бази даних
redis-cli DBSIZE

# Використання пам'яті
redis-cli INFO memory | grep used_memory_human

# Показати всі ключі маршрутів
redis-cli KEYS "larry:routes:*"
```

## 🗑️ Очищення кешу

```bash
# Через наші утиліти
npm run redis:clear

# Видалити всі ключі маршрутів
redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', 'larry:routes:*')))" 0

# Видалити конкретний маршрут
redis-cli DEL "larry:routes:route:ROUTE_ID"

# Очистити всю базу (ОБЕРЕЖНО!)
redis-cli FLUSHDB
```

## 🔧 Робота з конкретними маршрутами

```bash
# Отримати маршрут за ID
redis-cli GET "larry:routes:route:ROUTE_ID"

# Перевірити існування маршруту
redis-cli EXISTS "larry:routes:route:ROUTE_ID"

# Час життя ключа (TTL)
redis-cli TTL "larry:routes:route:ROUTE_ID"

# Детальна інформація про маршрут
node inspect-redis.cjs route ROUTE_ID
```

## 📈 Моніторинг в реальному часі

```bash
# Відстеження всіх команд
redis-cli MONITOR

# Відстеження тільки команд з маршрутами
redis-cli MONITOR | grep "larry:routes"

# Статистика команд
redis-cli INFO commandstats
```

## 🧪 Тестування

```bash
# Тест паралельного завантаження
npm run test:parallel

# Тест швидкості Redis
redis-benchmark -t set,get -n 1000 -q

# Перевірка здоров'я системи
npm run proxy:health
```

## 🚨 Troubleshooting

```bash
# Перевірка статусу Redis
redis-cli ping

# Перевірка порту
netstat -tlnp | grep :6379

# Перезапуск Redis
sudo systemctl restart redis

# Логи Redis (Ubuntu)
sudo journalctl -u redis -f
```

## 💡 Корисні поєднання команд

```bash
# Швидка перевірка системи
redis-cli ping && npm run redis:stats

# Очистити кеш та перевірити
npm run redis:clear && npm run redis:stats

# Пошук та детальна інформація
npm run redis:search Berlin && node inspect-redis.cjs route ROUTE_ID

# Повний цикл тестування
npm run test:parallel && npm run redis:inspect
```

## 📋 Щоденні команди

```bash
# Ранкова перевірка
redis-cli ping && npm run redis:stats

# Пошук нових маршрутів
npm run redis:search "YOUR_CITY"

# Вечірнє очищення (опціонально)
npm run redis:clear
```

## 🎯 Найчастіше використовувані

1. `npm run redis:inspect` - загальний огляд кешу
2. `npm run redis:search Berlin` - пошук маршрутів
3. `redis-cli KEYS "larry:routes:*"` - всі ключі
4. `npm run redis:clear` - очистити кеш
5. `redis-cli ping` - перевірка підключення