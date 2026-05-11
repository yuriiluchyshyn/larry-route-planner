import { useState, useEffect } from 'react';

interface TruckCosts {
  // Configuration
  monthlyKm: number;
  averageSpeed: number; // km/h
  ratePerKm: number; // EUR/km
  emptyPercentage: number; // % empty runs
  
  // Driver and time
  driverBasePLN: number; // PLN/month
  dietPerDay: number; // EUR/day
  
  // Operations and admin
  leasingCost: number; // EUR/month
  servicePerKm: number; // EUR/km
  tiresPerKm: number; // EUR/km
  accountant: number; // EUR/month
  office: number; // EUR/month
  software: number; // EUR/month
}

export function TruckFinanceCalculator() {
  // Constants from HTML
  const PLN_EUR = 0.23;
  const TAX_DRIVER_MULT = 1.21;
  const FUEL_CONS = 33 / 100; // 33L/100km
  const FUEL_PRICE_EUR = 1.35; // EUR/L
  const ADBLUE_RATE = 0.015; // EUR/km for AdBlue
  const TOLL_RATE = 0.22; // EUR/km
  const LEGAL_MAX_HOURS = 180; // max hours per month
  const DRIVING_HOURS_PER_DAY = 9; // driving hours per day

  const [costs, setCosts] = useState<TruckCosts>({
    // Route configuration
    monthlyKm: 12000,
    averageSpeed: 70, // km/h
    ratePerKm: 1.60, // EUR/km
    emptyPercentage: 10, // % empty runs
    
    // Driver and time
    driverBasePLN: 4300, // PLN/month
    dietPerDay: 75, // EUR/day
    
    // Operations and admin
    leasingCost: 1500, // EUR/month
    servicePerKm: 0.05, // EUR/km
    tiresPerKm: 0.02, // EUR/km
    accountant: 350, // EUR/month
    office: 250, // EUR/month
    software: 150, // EUR/month
  });

  const [results, setResults] = useState({
    // Time and work
    driveHours: 0,
    autoDays: 0,
    paidKm: 0,
    workloadPercentage: 0,
    hoursStatus: 'OK',
    
    // Costs
    fuelCost: 0,
    tollCost: 0,
    dietTotal: 0,
    maintenanceCost: 0,
    totalVariableCosts: 0,
    
    driverFixed: 0,
    adminFixed: 0,
    totalFixedCosts: 0,
    
    // Results
    revenue: 0,
    totalExpenses: 0,
    profit: 0,
    margin: 0,
    
    // Analysis
    costPerKm: 0,
    netPerKm: 0,
    breakEvenKm: 0,
    breakEvenProgress: 0,
  });

  useEffect(() => {
    calculateCosts();
  }, [costs]);

  const calculateCosts = () => {
    // 1. Time calculations
    const driveHours = costs.monthlyKm / costs.averageSpeed;
    const autoDays = Math.ceil(driveHours / DRIVING_HOURS_PER_DAY);
    const paidKm = costs.monthlyKm * (1 - costs.emptyPercentage / 100);
    
    // Working hours status
    const workloadPercentage = Math.min((driveHours / LEGAL_MAX_HOURS) * 100, 100);
    let hoursStatus = 'OK';
    if (driveHours > LEGAL_MAX_HOURS) {
      hoursStatus = 'ILLEGAL';
    } else if (driveHours > LEGAL_MAX_HOURS * 0.85) {
      hoursStatus = 'RISK';
    }

    // 2. Variable costs
    const fuelCost = (costs.monthlyKm * FUEL_CONS * FUEL_PRICE_EUR) + (costs.monthlyKm * ADBLUE_RATE);
    const tollCost = costs.monthlyKm * TOLL_RATE;
    const dietTotal = autoDays * costs.dietPerDay;
    const maintenanceCost = costs.monthlyKm * (costs.servicePerKm + costs.tiresPerKm);
    const totalVariableCosts = fuelCost + tollCost + dietTotal + maintenanceCost;

    // 3. Fixed costs
    const driverFixed = (costs.driverBasePLN * PLN_EUR) * TAX_DRIVER_MULT;
    const adminFixed = costs.leasingCost + costs.accountant + costs.office + costs.software;
    const totalFixedCosts = driverFixed + adminFixed;

    // 4. Results
    const revenue = paidKm * costs.ratePerKm;
    const totalExpenses = totalVariableCosts + totalFixedCosts;
    const profit = revenue - totalExpenses;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const costPerKm = totalExpenses / costs.monthlyKm;
    const netPerKm = profit / costs.monthlyKm;

    // 5. Break-even analysis
    // Contribution margin per km = (Revenue per km) - (Variable cost per km)
    const revPerKm = paidKm * costs.ratePerKm / costs.monthlyKm;
    const vcPerKm = totalVariableCosts / costs.monthlyKm;
    const cmPerKm = revPerKm - vcPerKm;
    
    let breakEvenKm = 0;
    if (cmPerKm > 0) {
      breakEvenKm = totalFixedCosts / cmPerKm;
    }
    
    const breakEvenProgress = Math.min((costs.monthlyKm / breakEvenKm) * 100, 100);

    setResults({
      driveHours,
      autoDays,
      paidKm,
      workloadPercentage,
      hoursStatus,
      
      fuelCost,
      tollCost,
      dietTotal,
      maintenanceCost,
      totalVariableCosts,
      
      driverFixed,
      adminFixed,
      totalFixedCosts,
      
      revenue,
      totalExpenses,
      profit,
      margin,
      
      costPerKm,
      netPerKm,
      breakEvenKm,
      breakEvenProgress,
    });
  };

  const handleInputChange = (field: keyof TruckCosts, value: number) => {
    setCosts(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="finance-calculator">
      <div className="finance-section">
        <h4>🚛 Конфігурація рейсу</h4>
        
        <div className="finance-category">
          <h5>Основні параметри</h5>
          <div className="finance-input-group">
            <div className="finance-input-row">
              <div className="finance-input">
                <label>Загальний пробіг (км/місяць)</label>
                <input
                  type="number"
                  value={costs.monthlyKm}
                  onChange={(e) => handleInputChange('monthlyKm', Number(e.target.value))}
                />
              </div>
              <div className="finance-input">
                <label>Середня швидкість (км/год)</label>
                <input
                  type="number"
                  value={costs.averageSpeed}
                  onChange={(e) => handleInputChange('averageSpeed', Number(e.target.value))}
                />
              </div>
            </div>
            <div className="finance-input-row">
              <div className="finance-input">
                <label>Ставка (€/км)</label>
                <input
                  type="number"
                  step="0.01"
                  value={costs.ratePerKm}
                  onChange={(e) => handleInputChange('ratePerKm', Number(e.target.value))}
                />
              </div>
              <div className="finance-input">
                <label>Холостий хід (%)</label>
                <input
                  type="number"
                  value={costs.emptyPercentage}
                  onChange={(e) => handleInputChange('emptyPercentage', Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="finance-category">
          <h5>Водій та час</h5>
          <div className="finance-input-group">
            <div className="finance-input-row">
              <div className="finance-input">
                <label>Основа водія (PLN/місяць)</label>
                <input
                  type="number"
                  value={costs.driverBasePLN}
                  onChange={(e) => handleInputChange('driverBasePLN', Number(e.target.value))}
                />
              </div>
              <div className="finance-input">
                <label>Дієта (€/день)</label>
                <input
                  type="number"
                  value={costs.dietPerDay}
                  onChange={(e) => handleInputChange('dietPerDay', Number(e.target.value))}
                />
              </div>
            </div>
          </div>
          
          <div className="finance-result-item">
            <span className="finance-result-label">За кермом:</span>
            <span className="finance-result-value">{Math.round(results.driveHours)} год ({results.hoursStatus})</span>
          </div>
          <div className="finance-result-item">
            <span className="finance-result-label">Автономних днів:</span>
            <span className="finance-result-value">{results.autoDays} днів</span>
          </div>
        </div>
      </div>

      <div className="finance-section">
        <h4>💼 Експлуатація та адміністрування</h4>
        
        <div className="finance-category">
          <h5>Фіксовані витрати</h5>
          <div className="finance-input-group">
            <div className="finance-input-row">
              <div className="finance-input">
                <label>Лізинг (€/місяць)</label>
                <input
                  type="number"
                  value={costs.leasingCost}
                  onChange={(e) => handleInputChange('leasingCost', Number(e.target.value))}
                />
              </div>
              <div className="finance-input">
                <label>Бухгалтер (€/місяць)</label>
                <input
                  type="number"
                  value={costs.accountant}
                  onChange={(e) => handleInputChange('accountant', Number(e.target.value))}
                />
              </div>
            </div>
            <div className="finance-input-row">
              <div className="finance-input">
                <label>Офіс (€/місяць)</label>
                <input
                  type="number"
                  value={costs.office}
                  onChange={(e) => handleInputChange('office', Number(e.target.value))}
                />
              </div>
              <div className="finance-input">
                <label>GPS/ПО (€/місяць)</label>
                <input
                  type="number"
                  value={costs.software}
                  onChange={(e) => handleInputChange('software', Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="finance-category">
          <h5>Змінні витрати на км</h5>
          <div className="finance-input-group">
            <div className="finance-input-row">
              <div className="finance-input">
                <label>Сервіс/Ремонт (€/км)</label>
                <input
                  type="number"
                  step="0.01"
                  value={costs.servicePerKm}
                  onChange={(e) => handleInputChange('servicePerKm', Number(e.target.value))}
                />
              </div>
              <div className="finance-input">
                <label>Шини (€/км)</label>
                <input
                  type="number"
                  step="0.01"
                  value={costs.tiresPerKm}
                  onChange={(e) => handleInputChange('tiresPerKm', Number(e.target.value))}
                />
              </div>
            </div>
          </div>
          
          <div className="finance-info">
            <p><strong>Автоматичні розрахунки:</strong></p>
            <p>• Паливо та AdBlue: €{FUEL_CONS.toFixed(2)}/км × €{FUEL_PRICE_EUR}/л + €{ADBLUE_RATE}/км</p>
            <p>• Дорожні збори: €{TOLL_RATE}/км</p>
            <p>• Конвертація PLN→EUR: {PLN_EUR}</p>
            <p>• Податки на водія: ×{TAX_DRIVER_MULT}</p>
          </div>
        </div>
      </div>

      <div className="finance-results">
        <h4>💰 Аналіз витрат та доходів</h4>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Загальний дохід:</span>
          <span className="finance-result-value finance-positive">€{Math.round(results.revenue).toLocaleString()}</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Паливо та AdBlue:</span>
          <span className="finance-result-value finance-negative">-€{Math.round(results.fuelCost).toLocaleString()}</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Дорожні збори:</span>
          <span className="finance-result-value finance-negative">-€{Math.round(results.tollCost).toLocaleString()}</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Дієти водія:</span>
          <span className="finance-result-value finance-negative">-€{Math.round(results.dietTotal).toLocaleString()}</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Ремонт та шини:</span>
          <span className="finance-result-value finance-negative">-€{Math.round(results.maintenanceCost).toLocaleString()}</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Основа водія + податки:</span>
          <span className="finance-result-value finance-negative">-€{Math.round(results.driverFixed).toLocaleString()}</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Адмін. витрати:</span>
          <span className="finance-result-value finance-negative">-€{Math.round(results.adminFixed).toLocaleString()}</span>
        </div>
        
        <div className="finance-result-item finance-total">
          <span className="finance-result-label">Чистий прибуток:</span>
          <span className={`finance-result-value ${results.profit >= 0 ? 'finance-positive' : 'finance-negative'}`}>
            €{Math.round(results.profit).toLocaleString()}
          </span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Маржа:</span>
          <span className="finance-result-value">{results.margin.toFixed(1)}%</span>
        </div>
      </div>

      <div className="finance-results">
        <h4>🎯 Аналіз точки окупності</h4>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Щоб покрити фіксовані витрати, треба проїхати:</span>
          <span className="finance-result-value">{Math.round(results.breakEvenKm).toLocaleString()} км</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Прогрес до точки окупності:</span>
          <span className="finance-result-value">{Math.round(results.breakEvenProgress)}%</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Собівартість км:</span>
          <span className="finance-result-value">€{results.costPerKm.toFixed(3)}</span>
        </div>
        
        <div className="finance-result-item">
          <span className="finance-result-label">Чистий € / 1 км:</span>
          <span className={`finance-result-value ${results.netPerKm >= 0 ? 'finance-positive' : 'finance-negative'}`}>
            €{results.netPerKm.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  );
}