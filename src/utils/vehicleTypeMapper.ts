/**
 * Vehicle Type Mapper
 * Мапінг українських назв типів транспорту в API коди Trans.eu
 */

/**
 * Мапінг українських назв типів транспорту в API коди
 */
export const VEHICLE_TYPE_MAPPING: Record<string, string> = {
  // Українські назви -> API коди
  'з напівпричепом': '2_double_trailer',
  'Вантажівка(3.5т - 12т)': '3_lorry', 
  'Бус': '1_van',
  'з причепом': '4_truck_trailer',
  
  // Додаткові варіанти написання
  'з напiвпричепом': '2_double_trailer',
  'Вантажiвка(3.5т - 12т)': '3_lorry',
  'з причiпом': '4_truck_trailer',
  
  // Англійські назви (якщо будуть)
  'with semi-trailer': '2_double_trailer',
  'Truck(3.5t - 12t)': '3_lorry',
  'Van': '1_van',
  'with trailer': '4_truck_trailer',
  
  // Німецькі назви (якщо будуть)
  'mit Sattelanhänger': '2_double_trailer',
  'LKW(3.5t - 12t)': '3_lorry',
  'Transporter': '1_van',
  'mit Anhänger': '4_truck_trailer',
  
  // Польські назви (якщо будуть)
  'z naczepą': '2_double_trailer',
  'Ciężarówka(3.5t - 12t)': '3_lorry',
  'Bus': '1_van',
  'z przyczepą': '4_truck_trailer'
};

/**
 * Всі доступні типи транспорту в API
 */
export const ALL_VEHICLE_TYPES = [
  '1_van',                // фургон/бус
  '2_double_trailer',     // з напівпричепом
  '3_lorry',             // вантажівка (3.5т - 12т)
  '4_truck_trailer',     // з причепом
  '5_solo',              // одиночна вантажівка
  '6_road_train'         // автопоїзд
];

/**
 * Конвертувати українські назви типів транспорту в API коди
 */
export function convertVehicleTypesToApiCodes(vehicleTypes: string[]): string[] {
  if (!vehicleTypes || vehicleTypes.length === 0) {
    // Якщо не вибрано жодного типу, повертаємо дефолтні
    return ['2_double_trailer', '3_lorry', '5_solo'];
  }

  const apiCodes: string[] = [];
  
  for (const vehicleType of vehicleTypes) {
    const trimmedType = vehicleType.trim();
    const apiCode = VEHICLE_TYPE_MAPPING[trimmedType];
    
    if (apiCode) {
      apiCodes.push(apiCode);
      console.log(`Larry: Mapped vehicle type "${trimmedType}" -> "${apiCode}"`);
    } else {
      console.warn(`Larry: Unknown vehicle type: "${trimmedType}"`);
      // Якщо не знаємо тип, додаємо як є (можливо це вже API код)
      if (ALL_VEHICLE_TYPES.includes(trimmedType)) {
        apiCodes.push(trimmedType);
      }
    }
  }
  
  // Видаляємо дублікати
  const uniqueApiCodes = [...new Set(apiCodes)];
  
  console.log('Larry: Final vehicle types for API:', uniqueApiCodes);
  
  // Якщо після конвертації нічого не залишилось, повертаємо дефолтні
  if (uniqueApiCodes.length === 0) {
    console.log('Larry: No valid vehicle types found, using defaults');
    return ['2_double_trailer', '3_lorry', '5_solo'];
  }
  
  return uniqueApiCodes;
}

/**
 * Конвертувати API коди назад в українські назви (для відображення)
 */
export function convertApiCodesToVehicleTypes(apiCodes: string[]): string[] {
  const reverseMapping: Record<string, string> = {};
  
  // Створюємо зворотний мапінг
  for (const [ukrainianName, apiCode] of Object.entries(VEHICLE_TYPE_MAPPING)) {
    if (!reverseMapping[apiCode]) {
      reverseMapping[apiCode] = ukrainianName;
    }
  }
  
  return apiCodes.map(code => reverseMapping[code] || code);
}

/**
 * Перевірити чи є тип транспорту валідним
 */
export function isValidVehicleType(vehicleType: string): boolean {
  return VEHICLE_TYPE_MAPPING.hasOwnProperty(vehicleType) || 
         ALL_VEHICLE_TYPES.includes(vehicleType);
}

/**
 * Отримати всі доступні українські назви типів транспорту
 */
export function getAvailableVehicleTypeNames(): string[] {
  return Object.keys(VEHICLE_TYPE_MAPPING).filter(name => 
    // Повертаємо тільки основні українські назви
    ['з напівпричепом', 'Вантажівка(3.5т - 12т)', 'Бус', 'з причепом'].includes(name)
  );
}