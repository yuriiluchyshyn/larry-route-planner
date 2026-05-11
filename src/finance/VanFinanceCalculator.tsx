import { useState, useEffect } from 'react';

interface VanCosts {
  // Route parameters
  monthlyKm: number;
  ratePerKmPLN: number; // PLN/km
  emptyPercentage: number; // % empty runs
  
  // Variable costs
  fuelConsumption: number; // L/100km
  fuelPricePLN: number; // PLN/L
  maintenancePerKm: number; // PLN/km (repairs, tires, tolls)
  
  // Fixed costs
  amortizationPLN: number; // PLN/month
  healthTaxPLN: number; // PLN/month (Zdrowotna)
  accountantPLN: number; // PLN/month
  insurancePLN: number; // PLN/month
  taxRate: number; // % (Rychalt)
}

export function VanFinanceCalculator() {
  const [costs, setCosts] = useState<VanCosts>({
    // Route parameters
    monthlyKm: 10000,
    ratePerKmPLN: 2.50, // PLN/km
    emptyPercentage: 10, // % empty runs
    
    // Variable costs
    fuelConsumption: 10.5, // L/100km
    fuelPricePLN: 6.50, // PLN/L
    maintenancePerKm: 0.20, // PLN/km (repairs, tires, tolls)
    
    // Fixed costs
    amortizationPLN: 1343, // PLN/month (15k EUR / 4 years)
    healthTaxPLN: 419, // PLN/month (Zdrowotna)
    accountantPLN: 250, // PLN/month
    insurancePLN: 700, // PLN/month (OC/AC/OCP)
    taxRate: 5.5, // % (Rychalt)
  });

  const [results, setResults] = useState({
    loadedKm: 0,
    revenue: 0,
    
    fuelCost: 0,
    totalVariableCosts: 0,
    
    fixedCosts: 0,
    tax: 0,
    
    totalCosts: 0,
    profit: 0,
    margin: 0,
    
    breakEvenKm: 0,
    isProfitableModel: true,
  });

  useEffect(() => {
    calculateCosts();
  }, [costs]);

  const calculateCosts = () => {
    // Calculations according to HTML logic
    const loadedKm = costs.monthlyKm * (1 - costs.emptyPercentage / 100);
    const revenue = loadedKm * costs.ratePerKmPLN; // Gross revenue only for paid km
    
    // Variable costs
    const fuelCostPerKm = (costs.fuelConsumption / 100) * costs.fuelPricePLN;
    const totalVarCostPerKm = fuelCostPerKm + costs.maintenancePerKm; // Variable costs per 1 km
    const totalVariableCosts = costs.monthlyKm * totalVarCostPerKm; // Costs for all km (empty and loaded)

    // Fixed costs
    const fixedCosts = costs.amortizationPLN + costs.healthTaxPLN + costs.accountantPLN + costs.insurancePLN;
    
    // Tax on gross revenue
    const tax = revenue * (costs.taxRate / 100);
    
    // Results
    const totalCosts = totalVariableCosts + fixedCosts + tax;
    const profit = revenue - totalCosts;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // Break Even Point Calculation (according to HTML)
    // Revenue(x) = x * (1 - emptyPct) * rate
    // VarCost(x) = x * totalVarCostPerKm
    // Tax(x) = Revenue(x) * taxRate
    // Profit = 0 => Revenue(x) - VarCost(x) - Tax(x) - fixedCosts = 0
    // x * [ (1 - emptyPct) * rate * (1 - taxRate) - totalVarCostPerKm ] = fixedCosts
    const netMarginPerKm = ((1 - costs.emptyPercentage / 100) * costs.ratePerKmPLN * (1 - costs.taxRate / 100)) - totalVarCostPerKm;
    let breakEvenKm = 0;
    let isProfitableModel = true;

    if (netMarginPerKm > 0) {
      breakEvenKm = fixedCosts / netMarginPerKm;
    } else {
      isProfitableModel = false;
    }

    setResults({
      loadedKm,
      revenue,
      
      fuelCost: costs.monthlyKm * fuelCostPerKm,
      totalVariableCosts,
      
      fixedCosts,
      tax,
      
      totalCosts,
      profit,
      margin,
      
      breakEvenKm,
      isProfitableModel,
    });
  };

  const handleInputChange = (field: keyof VanCosts, value: number) => {
    setCosts(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatMoney = (num: number) => {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(num);
  };

  const formatNum = (num: number) => {
    return new Intl.NumberFormat('pl-PL').format(num);
  };

  return (
    <div className="finance-calculator">
      <div className="finance-section">
        <h4>🚐 Параметри рейсів</h4>
        
        <div className="finance-category">
          <h5>Основні параметри</h5>
          <div className="finance-input-group">
            <div className="finance-input-row">
              <div className="finance-input">
                <label>Місячний пробіг (км)</label>
                <input
                  type="number"
                  value={costs.monthlyKm}
                  onChange={(e) => handleInputChange('monthlyKm', Number(e.target.value))}
                />
              </div>
              <div className="finance-input">
                <label>Ставка за 1 км (PLN)</label>
                <input
                  type="number"
                  step="0.05"
                  value={costs.ratePerKmPLN}
                  onChange={(e) => handleInputChange('ratePerKmPLN', Number(e.target.value))}
                />
              </div>
            </div>
            <div className="finance-input">
              <label>Холостий хід (% від пробігу)</label>
              <input
                type="number"
                value={costs.emptyPercentage}
                onChange={(e) => handleInputChange('emptyPercentage', Number(e.target.value))}
              />
              <p className="finance-help">Відсоток кілометрів, за які тобі не платять.</p>
            </div>
          </div>
          
          <div className="finance-result-item">
            <span className="finance-result-label">Платні кілометри:</span>
            <span className="finance-result-value">{formatNum(results.loadedKm)} км</span>
          </div>
        </div>
      </div>

      <div className="finance-section">
        <h4>⛽ Змінні витрати</h4>
        
        <div className="finance-category">
          <h5>Паливо та обслуговування</h5>
          <div className="finance-input-group">
            <div className="finance-input-row">
              <div className="finance-input">
                <label>Витрата палива (л/100км)</label>
                <input
                  type="number"
                  step="0.1"
                  value={costs.fuelConsumption}
                  onChange={(e) => handleInputChange('fuelConsumption', Number(e.target.value))}
                />
              </div>
              <div className="finance-input">
                <label>Ціна палива (PLN/л)</label>
                <input
                  type="number"
                  step="0.05"
                  value={costs.fuelPricePLN}
                  onChange={(e) => handleInputChange('fuelPricePLN', Number(e.target.value))}
                />
              </div>
            </div>
            <div className="finance-input">
              <label>Ремонти, шини, автостради (PLN/км)</label>
              <input
                type="number"
                step="0.01"
                value={costs.maintenancePerKm}
                onChange={(e) => handleInputChange('maintenancePerKm', Number(e.target.value))}
              />
              <p className="finance-help">Резерв на сервіс та дрібні оплати доріг.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="finance-section">
        <h4>🔒 Фіксовані витрати (місяць)</h4>
        
        <div className="finance-category">
          <h5>Обов'язкові платежі</h5>
          <div className="finance-input-group">
            <div className="finance-input">
              <label>Амортизація буса (PLN)</label>
              <input
                type="number"
                value={costs.amortizationPLN}
                onChange={(e) => handleInputChange('amortizationPLN', Number(e.target.value))}
              />
              <p className="finance-help">15k EUR / 4 роки = ~1343 PLN. Гроші, які авто "з'їдає" втрачаючи ціну.</p>
            </div>
            
            <div className="finance-input">
              <label>Податок на здоров'я (Zdrowotna) PLN</label>
              <input
                type="number"
                value={costs.healthTaxPLN}
                onChange={(e) => handleInputChange('healthTaxPLN', Number(e.target.value))}
              />
              <p className="finance-help">Обов'язкова для ричалту (до 60 тис доходу - 419 zł).</p>
            </div>
            
            <div className="finance-input-row">
              <div className="finance-input">
                <label>Бухгалтерія (PLN)</label>
                <input
                  type="number"
                  value={costs.accountantPLN}
                  onChange={(e) => handleInputChange('accountantPLN', Number(e.target.value))}
                />
              </div>
              <div className="finance-input">
                <label>Страховки (OC/AC/OCP) PLN</label>
                <input
                  type="number"
                  value={costs.insurancePLN}
                  onChange={(e) => handleInputChange('insurancePLN', Number(e.target.value))}
                />
              </div>
            </div>
            
            <div className="finance-input">
              <label>Ставка податку Ричалт (%)</label>
              <select 
                value={costs.taxRate} 
                onChange={(e) => handleInputChange('taxRate', Number(e.target.value))}
                className="finance-select"
              >
                <option value={5.5}>5.5% (Стандарт для транспорту)</option>
                <option value={8.5}>8.5% (Інші послуги)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="finance-results">
        <h4>💰 Результат за місяць</h4>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Брудний дохід (Оборот):</span>
          <span className="finance-result-value finance-positive">{formatMoney(results.revenue)}</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">- Змінні витрати (паливо, сервіс):</span>
          <span className="finance-result-value finance-negative">{formatMoney(results.totalVariableCosts)}</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">- Фіксовані витрати + Аморт.:</span>
          <span className="finance-result-value finance-negative">{formatMoney(results.fixedCosts)}</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">- Податок (Ричалт):</span>
          <span className="finance-result-value finance-negative">{formatMoney(results.tax)}</span>
        </div>
        
        <div className="finance-result-item finance-total">
          <span className="finance-result-label">Чистий прибуток (на руки):</span>
          <span className={`finance-result-value ${results.profit >= 0 ? 'finance-positive' : 'finance-negative'}`}>
            {formatMoney(results.profit)}
          </span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Маржинальність:</span>
          <span className="finance-result-value">{results.margin.toFixed(1)}%</span>
        </div>
      </div>

      <div className="finance-results">
        <h4>🎯 Нульова точка (Break-Even Point)</h4>
        
        {results.isProfitableModel ? (
          <>
            <div className="finance-result-item">
              <span className="finance-result-label">Скільки кілометрів треба проїхати з цими параметрами, щоб відбити фіксовані витрати та вийти в "нуль":</span>
              <span className="finance-result-value finance-positive">{formatNum(Math.ceil(results.breakEvenKm))} км</span>
            </div>
            
            {results.breakEvenKm > costs.monthlyKm ? (
              <div className="finance-warning">
                <p>⚠️ Увага! При поточному пробігу ти не досягаєш нульової точки.</p>
              </div>
            ) : (
              <div className="finance-success">
                <p>✅ Після цього пробігу кожен кілометр приносить чистий плюс.</p>
              </div>
            )}
          </>
        ) : (
          <div className="finance-error">
            <div className="finance-result-item">
              <span className="finance-result-label">Нульова точка:</span>
              <span className="finance-result-value finance-negative">Ніколи</span>
            </div>
            <p>❌ Збиткова бізнес-модель! Твої витрати на 1 км перевищують дохід з урахуванням пустих пробігів.</p>
          </div>
        )}
      </div>
    </div>
  );
}