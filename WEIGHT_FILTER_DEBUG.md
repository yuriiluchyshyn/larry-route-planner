# 🔧 Налагодження фільтрів ваги в Larry Route Planner Extension

## Проблема
Extension не зчитує мінімальну і максимальну вагу з фільтрів на сайті platform.trans.eu.

## Що було виправлено

### 1. Extension (content.js)
- ✅ Додано більше селекторів для пошуку полів ваги
- ✅ Додано підтримку специфічних ID з HTML (`input[id=":r5:"]`)
- ✅ Покращено логіку парсингу з перевіркою порожніх значень
- ✅ Додано детальне логування для налагодження

### 2. Типи (types.ts)
- ✅ Додано `maxWeight?: number` до інтерфейсу `RouteConfig`
- ✅ Додано `maxCapacity?: number` до інтерфейсу `RouteConfig`

### 3. API Client (apiClient.ts)
- ✅ Додано підтримку `maxWeight` в фільтрах API
- ✅ Додано підтримку `maxCapacity` в фільтрах API
- ✅ Покращено логіку - фільтри додаються тільки якщо значення задані

### 4. Основний додаток (App.tsx)
- ✅ Додано обробку `maxWeight` і `maxCapacity` з URL параметрів
- ✅ Додано обробку `maxWeight` і `maxCapacity` з повідомлень extension
- ✅ Оновлено `defaultConfig` для підтримки нових полів

## Як тестувати

### Метод 1: Повний тест потоку
1. **Відкрийте Trans.eu з extension:**
   - Перейдіть на platform.trans.eu
   - Встановіть фільтр ваги на 3.5т (як у вашому прикладі)
   - Відкрийте Larry Route Planner extension (кнопка 🚛)

2. **Запустіть повний тест:**
   - Відкрийте консоль браузера (F12)
   - Скопіюйте і вставте код з файлу `debug-weight-flow.js`
   - Перевірте результати в консолі

3. **Очікуваний вивід:**
   ```
   📊 SUMMARY:
   Min Weight: NOT FOUND
   Max Weight: 3.5
   Message Sent: YES
   API Filter: {"to":3.5}
   🎉 SUCCESS: Weight parsing is working correctly!
   ```

### Метод 2: Тестова сторінка
```bash
npm run dev
open http://localhost:7739/test-extension.html
```

### Метод 3: Консоль браузера на Trans.eu
1. Відкрийте platform.trans.eu
2. Заповніть фільтри ваги (наприклад, максимум 3.5т)
3. Відкрийте консоль браузера (F12)
4. Скопіюйте і виконайте код з файлу `test-weight-parsing.js`

### Метод 4: Extension в дії
1. Встановіть extension в Chrome
2. Відкрийте platform.trans.eu
3. Заповніть фільтри ваги
4. Натисніть кнопку Larry Route Planner (🚛)
5. Перевірте консоль браузера на повідомлення:
   ```
   Larry Extension: ✅ Set maxWeight to: 3.5
   Larry: Setting maxWeight from extension: 3.5
   ```

## Очікувані результати

При правильній роботі ви повинні бачити в консолі:
```
Larry Extension: Found max weight: 3.5
Larry Extension: Weight parsing debug info:
- weightFromInput: <input> value: ""
- weightToInput: <input> value: "3.5"
- Final weight filters: { minWeight: null, maxWeight: 3.5 }
```

## Якщо не працює

### Перевірте HTML структуру
1. Відкрийте DevTools на platform.trans.eu
2. Знайдіть поля ваги в Elements tab
3. Перевірте, чи відповідають селектори в `content.js`

### Типові селектори для ваги:
```javascript
// Основні селектори
'[data-ctx="load_weight.valueFrom"] input'
'[data-ctx="load_weight.valueTo"] input'

// Альтернативні селектори
'input[name="valueFrom"][parentname="load_weight"]'
'input[name="valueTo"][parentname="load_weight"]'

// За ID (може змінюватися)
'input[id=":r4:"]'  // мінімум
'input[id=":r5:"]'  // максимум
```

### Додайте нові селектори
Якщо HTML структура змінилася, додайте нові селектори в `content.js`:
```javascript
// У функції parseFiltersFromPage()
let weightToInput = document.querySelector('[data-ctx="load_weight.valueTo"] input');
if (!weightToInput) {
  weightToInput = document.querySelector('НОВИЙ_СЕЛЕКТОР_ТУТ');
}
```

## Логи для налагодження

Шукайте ці повідомлення в консолі:
- `Larry Extension: Starting to parse filters from page...`
- `Larry Extension: Weight parsing debug info:`
- `Larry Extension: Found min weight:` / `Larry Extension: Found max weight:`
- `Larry Extension: Final parsed filters:`

## Контакти
Якщо проблема не вирішується, створіть issue з:
1. Скріншотом HTML структури полів ваги
2. Логами з консолі браузера
3. Версією браузера і extension

### Діагностика проблем

#### Якщо maxWeight не парситься:
1. **Перевірте HTML структуру:**
   ```javascript
   // Запустіть в консолі на Trans.eu
   console.log('Weight input:', document.querySelector('input[id=":r5:"]'));
   console.log('Value:', document.querySelector('input[id=":r5:"]')?.value);
   ```

2. **Перевірте чи змінилися ID:**
   - Trans.eu може використовувати різні ID як `:r6:`, `:r7:` тощо
   - Оновіть селектори в `extension/content.js` якщо потрібно

3. **Перевірте чи активний extension:**
   - Шукайте кнопку 🚛 на сторінці Trans.eu
   - Перевірте чи завантажений extension в chrome://extensions/

#### Якщо значення не з'являються в Larry app:
1. **Перевірте передачу повідомлень:**
   ```javascript
   // В консолі Larry iframe
   window.addEventListener('message', (e) => {
     if (e.data.type === 'FILTERS_RESPONSE') {
       console.log('Received filters:', e.data.filters);
     }
   });
   ```

2. **Перевірте оновлення конфігурації:**
   - Відкрийте Larry app
   - Розгорніть секцію "⚙️ Filter Parameters"
   - Повинно бути поле "Max Weight (t)" зі значенням 3.5

#### Якщо API фільтр неправильний:
1. **Перевірте API запит:**
   - Відкрийте вкладку Network в DevTools
   - Зробіть пошук в Larry
   - Знайдіть API запит до freight-offers
   - Перевірте payload запиту на `load_weight: {to: 3.5}`

### Швидка перевірка
Запустіть цей код в консолі на Trans.eu для швидкої діагностики:
```javascript
// Швидка перевірка всіх компонентів
const check = {
  weightInput: document.querySelector('input[id=":r5:"]'),
  weightValue: document.querySelector('input[id=":r5:"]')?.value,
  larryButton: document.getElementById('larry-route-planner-toggle'),
  larryPanel: document.getElementById('larry-route-planner-panel')
};
console.table(check);
```