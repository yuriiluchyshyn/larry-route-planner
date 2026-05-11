/**
 * Optimization Configuration
 * Конфігурація для оптимізації маршрутів - всі hardcode значення винесені сюди
 */

export interface OptimizationConfig {
  // === ОСНОВНІ ПАРАМЕТРИ ОПТИМІЗАЦІЇ ===
  defaults: {
    maxDistance: number;           // максимальна відстань в метрах
    minCapacity: number;           // мінімальна вантажопідйомність
    maxCapacity: number;           // максимальна вантажопідйомність
    costPerKm: number;            // євро за км
    fuelConsumption: number;      // л/100км
    fuelPrice: number;            // євро за літр
    maxEmptyRoad: number;         // максимальний відсоток порожнього проїзду
  };

  // === ВИТРАТИ НА ОПЕРАЦІЇ ===
  costs: {
    driverHourlyRate: number;     // євро за годину водія
    otherCostsPerKm: number;      // інші витрати на км
    loadingCostPerPoint: number;  // євро за точку завантаження
    unloadingCostPerPoint: number; // євро за точку розвантаження
  };

  // === РОЗРАХУНОК ЧАСУ ===
  timing: {
    averageSpeed: number;         // км/год середня швидкість
    restTimeInterval: number;     // км - інтервал для відпочинку
    restTimeDuration: number;     // години відпочинку
    bufferTimePercentage: number; // відсоток буферного часу
    loadingTimePerPoint: number;  // години на завантаження
    unloadingTimePerPoint: number; // години на розвантаження
  };

  // === РОЗПОДІЛ СЕГМЕНТІВ МАРШРУТУ ===
  segments: {
    baseToLoadingPercentage: number;    // відсоток відстані База → Завантаження
    loadingToUnloadingPercentage: number; // відсоток відстані Завантаження → Розвантаження
    unloadingToBasePercentage: number;  // відсоток відстані Розвантаження → База
  };

  // === РОЗРАХУНОК ПОРОЖНЬОГО ПРОЇЗДУ ===
  emptyRoad: {
    baseEmptyPercentage: number;        // базовий відсоток порожнього проїзду
    idealRouteAdjustment: number;       // коригування для ідеального маршруту
    complexRouteAdjustment: number;     // коригування для складного маршруту
  };

  // === ВАГИ ДЛЯ ОПТИМІЗАЦІЙНОГО СКОРУ ===
  scoring: {
    profitabilityWeight: number;        // вага прибутковості (0-1)
    efficiencyWeight: number;           // вага ефективності (0-1)
    distanceWeight: number;             // вага відстані (0-1)
    timeWeight: number;                 // вага часу (0-1)
    emptyRoadWeight: number;            // вага порожнього проїзду (0-1)
    routeStructureWeight: number;       // вага структури маршруту (0-1)
  };

  // === БОНУСИ ЗА СТРУКТУРУ МАРШРУТУ ===
  structureBonuses: {
    idealRouteBonus: number;            // бонус за ідеальний маршрут (1→1)
    goodRouteBonus: number;             // бонус за добрий маршрут (≤2 точок)
    complexRouteBonus: number;          // бонус за складний маршрут
    geographicConcentrationBonus: number; // бонус за географічну концентрацію
    complexityPenaltyPerPoint: number;  // штраф за кожну додаткову точку
    complexityThreshold: number;        // поріг складності (кількість точок)
  };

  // === АНАЛІЗ СКЛАДНОСТІ ===
  complexity: {
    scoring: {
      baseScore: number;                // базовий скор складності
      maxPointsBonus: number;           // максимальний бонус за точки
      maxCountriesBonus: number;        // максимальний бонус за країни
      multipleLoadingBonus: number;     // бонус за багато точок завантаження
      multipleUnloadingBonus: number;   // бонус за багато точок розвантаження
      maxScore: number;                 // максимальний скор
    };
    thresholds: {
      simple: number;                   // поріг для простого маршруту
      moderate: number;                 // поріг для помірного маршруту
      complex: number;                  // поріг для складного маршруту
    };
  };

  // === РЕКОМЕНДАЦІЇ ===
  recommendations: {
    thresholds: {
      lowProfit: number;                // поріг низької прибутковості
      lowEfficiency: number;            // поріг низької ефективності
      longDistance: number;             // поріг довгої відстані
      longDuration: number;             // поріг тривалого маршруту
      highEmptyRoad: number;            // поріг високого порожнього проїзду
      moderateEmptyRoad: number;        // поріг помірного порожнього проїзду
      excellentEmptyRoad: number;       // поріг відмінного порожнього проїзду
      manyLoadingPoints: number;        // поріг багатьох точок завантаження
      manyUnloadingPoints: number;      // поріг багатьох точок розвантаження
      manyCountries: number;            // поріг багатьох країн
      complexRoute: number;             // поріг складного маршруту
      longTotalDuration: number;        // поріг довгого загального часу
      longServiceTime: number;          // поріг довгого часу обслуговування
      longTotalDistance: number;        // поріг довгої загальної відстані
    };
  };

  // === ОЦІНКА ЦІНИ ===
  pricing: {
    baseRate: number;                   // базова ставка євро за км
    maxCapacityMultiplier: number;      // максимальний множник за вантажопідйомність
    capacityThreshold: number;          // поріг вантажопідйомності для множника
  };

  // === ФІЛЬТРАЦІЯ ЛОКАЦІЙ ===
  locationFiltering: {
    defaultRadius: number;              // радіус пошуку за замовчуванням в км
    maxRadius: number;                  // максимальний радіус пошуку в км
    minRadius: number;                  // мінімальний радіус пошуку в км
  };

  // === ПАРАМЕТРИ ТРАНСПОРТУ ===
  vehicle: {
    defaultSizes: string[];             // розміри транспорту за замовчуванням
    requiredSizes: string[];            // обов'язкові розміри транспорту
    availableSizes: string[];           // всі доступні розміри
  };

  // === КЕШУВАННЯ ===
  caching: {
    progressReportInterval: number;     // інтервал звітування про прогрес
  };
}

/**
 * Тип для часткової конфігурації з глибокою вкладеністю
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Дефолтна конфігурація оптимізації
 */
export const defaultOptimizationConfig: OptimizationConfig = {
  // === ОСНОВНІ ПАРАМЕТРИ ОПТИМІЗАЦІЇ ===
  defaults: {
    maxDistance: 1000000,       // 1000 км в метрах
    minCapacity: 1,             // 1 тонна
    maxCapacity: 50,            // 50 тонн
    costPerKm: 1.2,            // 1.2 євро за км
    fuelConsumption: 35,        // 35 л/100км
    fuelPrice: 1.4,            // 1.4 євро за літр
    maxEmptyRoad: 30,          // максимум 30% порожнього проїзду
  },

  // === ВИТРАТИ НА ОПЕРАЦІЇ ===
  costs: {
    driverHourlyRate: 15,       // 15 євро за годину
    otherCostsPerKm: 0.3,      // 0.3 євро за км
    loadingCostPerPoint: 25,    // 25 євро за точку завантаження
    unloadingCostPerPoint: 20,  // 20 євро за точку розвантаження
  },

  // === РОЗРАХУНОК ЧАСУ ===
  timing: {
    averageSpeed: 65,           // 65 км/год
    restTimeInterval: 200,      // кожні 200 км
    restTimeDuration: 0.75,     // 45 хв (0.75 години)
    bufferTimePercentage: 0.1,  // 10% буферного часу
    loadingTimePerPoint: 2,     // 2 години на завантаження
    unloadingTimePerPoint: 1.5, // 1.5 години на розвантаження
  },

  // === РОЗПОДІЛ СЕГМЕНТІВ МАРШРУТУ ===
  segments: {
    baseToLoadingPercentage: 0.3,      // 30% відстані
    loadingToUnloadingPercentage: 0.5,  // 50% відстані
    unloadingToBasePercentage: 0.2,     // 20% відстані
  },

  // === РОЗРАХУНОК ПОРОЖНЬОГО ПРОЇЗДУ ===
  emptyRoad: {
    baseEmptyPercentage: 0.5,           // 50% базовий порожній проїзд
    idealRouteAdjustment: -10,          // -10% для ідеального маршруту
    complexRouteAdjustment: 15,         // +15% для складного маршруту
  },

  // === ВАГИ ДЛЯ ОПТИМІЗАЦІЙНОГО СКОРУ ===
  scoring: {
    profitabilityWeight: 0.3,           // 30% прибутковість
    efficiencyWeight: 0.25,             // 25% ефективність
    distanceWeight: 0.15,               // 15% відстань
    timeWeight: 0.1,                    // 10% час
    emptyRoadWeight: 0.1,               // 10% порожній проїзд
    routeStructureWeight: 0.1,          // 10% структура маршруту
  },

  // === БОНУСИ ЗА СТРУКТУРУ МАРШРУТУ ===
  structureBonuses: {
    idealRouteBonus: 50,                // бонус за ідеальний маршрут
    goodRouteBonus: 30,                 // бонус за добрий маршрут
    complexRouteBonus: 10,              // бонус за складний маршрут
    geographicConcentrationBonus: 20,   // бонус за географічну концентрацію
    complexityPenaltyPerPoint: 5,       // штраф за кожну додаткову точку
    complexityThreshold: 5,             // поріг складності
  },

  // === АНАЛІЗ СКЛАДНОСТІ ===
  complexity: {
    scoring: {
      baseScore: 1,                     // базовий скор
      maxPointsBonus: 4,                // максимум +4 за точки
      maxCountriesBonus: 3,             // максимум +3 за країни
      multipleLoadingBonus: 1,          // +1 за багато завантажень
      multipleUnloadingBonus: 1,        // +1 за багато розвантажень
      maxScore: 10,                     // максимальний скор
    },
    thresholds: {
      simple: 3,                        // ≤3 простий
      moderate: 5,                      // ≤5 помірний
      complex: 7,                       // ≤7 складний
    },
  },

  // === РЕКОМЕНДАЦІЇ ===
  recommendations: {
    thresholds: {
      lowProfit: 100,                   // <100 євро низька прибутковість
      lowEfficiency: 0.5,               // <0.5 євро/км низька ефективність
      longDistance: 800,                // >800 км довга відстань
      longDuration: 10,                 // >10 год тривалий маршрут
      highEmptyRoad: 50,                // >50% високий порожній проїзд
      moderateEmptyRoad: 30,            // >30% помірний порожній проїзд
      excellentEmptyRoad: 15,           // ≤15% відмінний порожній проїзд
      manyLoadingPoints: 2,             // >2 багато точок завантаження
      manyUnloadingPoints: 2,           // >2 багато точок розвантаження
      manyCountries: 2,                 // >2 багато країн
      complexRoute: 4,                  // >4 складний маршрут
      longTotalDuration: 12,            // >12 год довгий загальний час
      longServiceTime: 6,               // >6 год довгий час обслуговування
      longTotalDistance: 800,           // >800 км довга загальна відстань
    },
  },

  // === ОЦІНКА ЦІНИ ===
  pricing: {
    baseRate: 1.5,                      // 1.5 євро за км
    maxCapacityMultiplier: 2,           // максимум x2
    capacityThreshold: 24,              // 24 тонни поріг
  },

  // === ФІЛЬТРАЦІЯ ЛОКАЦІЙ ===
  locationFiltering: {
    defaultRadius: 50,                  // 50 км радіус за замовчуванням
    maxRadius: 200,                     // максимум 200 км
    minRadius: 5,                       // мінімум 5 км
  },

  // === ПАРАМЕТРИ ТРАНСПОРТУ ===
  vehicle: {
    defaultSizes: ['2_double_trailer', '3_lorry', '5_solo'], // розміри за замовчуванням
    requiredSizes: ['2_double_trailer', '3_lorry', '5_solo'], // обов'язкові розміри
    availableSizes: [
      '1_van',                          // фургон
      '2_double_trailer',               // подвійний причіп
      '3_lorry',                        // вантажівка
      '4_truck_trailer',                // тягач з причепом
      '5_solo',                         // одиночна вантажівка
      '6_road_train'                    // автопоїзд
    ]
  },

  // === КЕШУВАННЯ ===
  caching: {
    progressReportInterval: 50,         // кожні 50 маршрутів
  },
};

/**
 * Отримати конфігурацію оптимізації
 */
export function getOptimizationConfig(customConfig?: DeepPartial<OptimizationConfig>): OptimizationConfig {
  if (!customConfig) {
    return defaultOptimizationConfig;
  }

  // Глибоке злиття конфігурацій
  return {
    defaults: { ...defaultOptimizationConfig.defaults, ...customConfig.defaults },
    costs: { ...defaultOptimizationConfig.costs, ...customConfig.costs },
    timing: { ...defaultOptimizationConfig.timing, ...customConfig.timing },
    segments: { ...defaultOptimizationConfig.segments, ...customConfig.segments },
    emptyRoad: { ...defaultOptimizationConfig.emptyRoad, ...customConfig.emptyRoad },
    scoring: { ...defaultOptimizationConfig.scoring, ...customConfig.scoring },
    structureBonuses: { ...defaultOptimizationConfig.structureBonuses, ...customConfig.structureBonuses },
    complexity: {
      scoring: { 
        ...defaultOptimizationConfig.complexity.scoring, 
        ...(customConfig.complexity?.scoring || {})
      },
      thresholds: { 
        ...defaultOptimizationConfig.complexity.thresholds, 
        ...(customConfig.complexity?.thresholds || {})
      },
    },
    recommendations: {
      thresholds: { 
        ...defaultOptimizationConfig.recommendations.thresholds, 
        ...(customConfig.recommendations?.thresholds || {})
      },
    },
    pricing: { ...defaultOptimizationConfig.pricing, ...customConfig.pricing },
    locationFiltering: { ...defaultOptimizationConfig.locationFiltering, ...customConfig.locationFiltering },
    vehicle: { 
      defaultSizes: (customConfig.vehicle?.defaultSizes || defaultOptimizationConfig.vehicle.defaultSizes).filter((size): size is string => size !== undefined),
      requiredSizes: (customConfig.vehicle?.requiredSizes || defaultOptimizationConfig.vehicle.requiredSizes).filter((size): size is string => size !== undefined),
      availableSizes: (customConfig.vehicle?.availableSizes || defaultOptimizationConfig.vehicle.availableSizes).filter((size): size is string => size !== undefined)
    },
    caching: { ...defaultOptimizationConfig.caching, ...customConfig.caching },
  };
}

/**
 * Валідація конфігурації
 */
export function validateOptimizationConfig(config: OptimizationConfig): string[] {
  const errors: string[] = [];

  // Перевірка ваг (повинні в сумі давати 1.0)
  const totalWeight = 
    config.scoring.profitabilityWeight +
    config.scoring.efficiencyWeight +
    config.scoring.distanceWeight +
    config.scoring.timeWeight +
    config.scoring.emptyRoadWeight +
    config.scoring.routeStructureWeight;

  if (Math.abs(totalWeight - 1.0) > 0.01) {
    errors.push(`Сума ваг повинна дорівнювати 1.0, поточна сума: ${totalWeight.toFixed(3)}`);
  }

  // Перевірка відсотків сегментів
  const totalSegments = 
    config.segments.baseToLoadingPercentage +
    config.segments.loadingToUnloadingPercentage +
    config.segments.unloadingToBasePercentage;

  if (Math.abs(totalSegments - 1.0) > 0.01) {
    errors.push(`Сума відсотків сегментів повинна дорівнювати 1.0, поточна сума: ${totalSegments.toFixed(3)}`);
  }

  // Перевірка позитивних значень
  if (config.defaults.maxDistance <= 0) errors.push('maxDistance повинна бути > 0');
  if (config.costs.driverHourlyRate <= 0) errors.push('driverHourlyRate повинна бути > 0');
  if (config.timing.averageSpeed <= 0) errors.push('averageSpeed повинна бути > 0');

  return errors;
}

/**
 * Приклад кастомної конфігурації
 */
export const exampleCustomConfig: DeepPartial<OptimizationConfig> = {
  defaults: {
    maxEmptyRoad: 25,           // більш строгий ліміт порожнього проїзду
    fuelPrice: 1.6,            // вища ціна палива
  },
  costs: {
    driverHourlyRate: 18,       // вища ставка водія
  },
  scoring: {
    profitabilityWeight: 0.35,  // більша вага прибутковості
    emptyRoadWeight: 0.15,      // більша вага порожнього проїзду
    efficiencyWeight: 0.2,      // менша вага ефективності
  },
  recommendations: {
    thresholds: {
      highEmptyRoad: 40,        // нижчий поріг для високого порожнього проїзду
      moderateEmptyRoad: 25,    // нижчий поріг для помірного порожнього проїзду
    },
  },
  vehicle: {
    defaultSizes: ['3_lorry', '5_solo'], // тільки вантажівки та одиночні
    requiredSizes: ['3_lorry', '5_solo'] // обов'язкові розміри
  },
  locationFiltering: {
    defaultRadius: 30,          // менший радіус пошуку
  }
};