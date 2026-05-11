# Redis Cache Commands

Цей документ містить команди для роботи з Redis кешем маршрутів.

## 🚀 Швидкий старт

### 1. Запуск Redis

```bash
# macOS (Homebrew)
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 --name redis redis:alpine

# Windows (WSL)
sudo service redis-server start
```

### 2. Перевірка підключення

```bash
redis-cli ping
# Відповідь: PONG
```

## 🔍 Інспекція кешу через наші утиліти

### Загальна статистика

```bash
# Показати статистику + приклади маршрутів
node inspect-redis.js

# Тільки статистика
node inspect-redis.js stats
```

### Пошук маршрутів

```bash
# Пошук всіх маршрутів з Berlin
node inspect-redis.js search Berlin

# Пошук маршрутів Berlin → Warsaw
node inspect-redis.js search Berlin Warsaw

# Пошук українських маршрутів
node inspect-redis.js search "Київ"
```

### Детальна інформація

```bash
# Інспекція конкретного маршруту
node inspect-redis.js route ROUTE_ID

# Очистити весь кеш
node inspect-redis.js clear

# Показати допомогу
node inspect-redis.js help
```

## 🛠️ Прямі Redis CLI команди

### Перегляд ключів

```bash
# Показати всі ключі маршрутів
redis-cli KEYS "larry:routes:*"

# Показати всі ключі індексів
redis-cli KEYS "larry:routes:index:*"

# Показати загальний індекс
redis-cli GET "larry:routes:routes_index"
```

### Статистика бази даних

```bash
# Загальна інформація про Redis
redis-cli INFO

# Кількість ключів в базі
redis-cli DBSIZE

# Використання пам'яті
redis-cli INFO memory
```

### Робота з конкретними маршрутами

```bash
# Отримати маршрут за ID
redis-cli GET "larry:routes:route:ROUTE_ID"

# Отримати індексну інформацію
redis-cli GET "larry:routes:index:ROUTE_ID"

# Перевірити існування маршруту
redis-cli EXISTS "larry:routes:route:ROUTE_ID"

# Час життя ключа (TTL)
redis-cli TTL "larry:routes:route:ROUTE_ID"
```

### Очищення кешу

```bash
# Видалити всі ключі маршрутів
redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', 'larry:routes:*')))" 0

# Видалити конкретний маршрут
redis-cli DEL "larry:routes:route:ROUTE_ID"
redis-cli DEL "larry:routes:index:ROUTE_ID"

# Очистити всю базу даних (ОБЕРЕЖНО!)
redis-cli FLUSHDB
```

## 📊 Моніторинг в реальному часі

### Відстеження команд

```bash
# Показувати всі команди в реальному часі
redis-cli MONITOR

# Показувати тільки команди з маршрутами
redis-cli MONITOR | grep "larry:routes"
```

### Статистика використання

```bash
# Статистика команд
redis-cli INFO commandstats

# Статистика клієнтів
redis-cli CLIENT LIST

# Повільні запити
redis-cli SLOWLOG GET 10
```

## 🔧 Налаштування та оптимізація

### Конфігурація Redis

```bash
# Поточна конфігурація
redis-cli CONFIG GET "*"

# Встановити максимальну пам'ять
redis-cli CONFIG SET maxmemory 256mb

# Політика видалення при нестачі пам'яті
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Збереження даних

```bash
# Примусове збереження
redis-cli BGSAVE

# Статус останнього збереження
redis-cli LASTSAVE

# Автоматичне збереження кожні 60 секунд при 1+ змінах
redis-cli CONFIG SET save "60 1"
```

## 🧪 Тестування та діагностика

### Тест продуктивності

```bash
# Тест швидкості Redis
redis-benchmark -t set,get -n 10000 -q

# Тест з нашими ключами
redis-benchmark -t set,get -n 1000 -d 1024 -P 16 -q --pattern="larry:routes:*"
```

### Аналіз пам'яті

```bash
# Аналіз використання пам'яті по типах
redis-cli --bigkeys

# Детальний аналіз пам'яті (Redis 4.0+)
redis-cli MEMORY USAGE "larry:routes:route:ROUTE_ID"
```

## 📋 Корисні запити для розробки

### Підрахунок маршрутів

```bash
# Кількість всіх маршрутів
redis-cli EVAL "return #redis.call('keys', 'larry:routes:route:*')" 0

# Кількість індексів
redis-cli EVAL "return #redis.call('keys', 'larry:routes:index:*')" 0
```

### Пошук за шаблоном

```bash
# Знайти маршрути з конкретним ID
redis-cli KEYS "larry:routes:route:*12345*"

# Знайти всі ключі з певною датою
redis-cli KEYS "larry:routes:*$(date +%Y%m%d)*"
```

### Експорт/Імпорт даних

```bash
# Експорт всіх маршрутів в файл
redis-cli --scan --pattern "larry:routes:*" | xargs redis-cli MGET > routes_backup.json

# Створення дампу бази
redis-cli --rdb dump.rdb
```

## 🚨 Troubleshooting

### Проблеми з підключенням

```bash
# Перевірка статусу Redis
redis-cli ping

# Перевірка порту
netstat -tlnp | grep :6379

# Логи Redis (Ubuntu)
sudo journalctl -u redis -f
```

### Проблеми з пам'яттю

```bash
# Поточне використання пам'яті
redis-cli INFO memory | grep used_memory_human

# Найбільші ключі
redis-cli --bigkeys

# Очищення expired ключів
redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', '*')))" 0
```

### Відновлення після збоїв

```bash
# Перезапуск Redis
sudo systemctl restart redis

# Відновлення з backup
redis-cli --rdb dump.rdb

# Перевірка цілісності
redis-cli DEBUG RESTART
```

## 📚 Додаткові ресурси

- [Redis Commands Reference](https://redis.io/commands)
- [Redis CLI Documentation](https://redis.io/topics/rediscli)
- [Redis Memory Optimization](https://redis.io/topics/memory-optimization)
- [Redis Persistence](https://redis.io/topics/persistence)