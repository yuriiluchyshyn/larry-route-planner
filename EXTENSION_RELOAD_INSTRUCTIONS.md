# Інструкції для перезавантаження Chrome Extension

## Чому потрібно перезавантажити extension?

Після внесення змін в файли extension (особливо `content.js` та `content.css`), Chrome не автоматично оновлює код. Потрібно вручну перезавантажити extension.

## Як перезавантажити extension:

### Метод 1: Через Chrome Extensions
1. Відкрийте Chrome
2. Перейдіть на `chrome://extensions/`
3. Знайдіть "Larry Route Planner" extension
4. Натисніть кнопку "🔄" (Reload) біля extension

### Метод 2: Через Developer Mode
1. Відкрийте `chrome://extensions/`
2. Увімкніть "Developer mode" (якщо не увімкнений)
3. Натисніть "Load unpacked" та виберіть папку `larry-route-planner/extension`
4. Або натисніть "Reload" біля вже завантаженого extension

### Метод 3: Повне перезавантаження
1. Видаліть extension з `chrome://extensions/`
2. Натисніть "Load unpacked"
3. Виберіть папку `larry-route-planner/extension`

## Перевірка що кнопка рефрешу з'явилась:

1. Перейдіть на platform.trans.eu
2. Натисніть на іконку Larry Route Planner (🚛) в правому нижньому куті
3. В заголовку панелі повинні бути 3 кнопки: `🔄 ⤢ ✕`
4. Кнопка `🔄` - це нова кнопка рефрешу

## Дебаг:

Якщо кнопка все ще не з'являється:

1. Відкрийте Developer Tools (F12)
2. Перейдіть на вкладку Console
3. Шукайте повідомлення від "Larry Extension"
4. Повинно бути: "✅ Refresh button event listener added"

## Тестування функціональності:

1. Змініть фільтри на platform.trans.eu (типи вантажівок, локації, вагу)
2. Натисніть кнопку `🔄` в Larry панелі
3. Кнопка повинна змінитись на `✅` на 1.5 секунди
4. Фільтри в Larry Route Planner повинні оновитись

## Файли що були змінені:

- `extension/content.js` - додана кнопка та функція refreshFilters
- `extension/content.css` - стилі вже були (не змінювались)
- `src/components/ConfigPanel.tsx` - перенесені типи вантажівок