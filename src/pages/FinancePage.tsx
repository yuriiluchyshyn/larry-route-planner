import { useState, useEffect } from 'react';
import { TruckFinanceCalculator } from '../finance/TruckFinanceCalculator';
import { VanFinanceCalculator } from '../finance/VanFinanceCalculator';
import '../finance/FinanceModal.css';

export function FinancePage() {
  const [selectedVehicle, setSelectedVehicle] = useState<'truck' | 'van' | null>(null);

  useEffect(() => {
    // Перевіряємо URL параметри для автоматичного вибору типу транспорту
    const urlParams = new URLSearchParams(window.location.search);
    const vehicleParam = urlParams.get('vehicle');
    if (vehicleParam === 'truck' || vehicleParam === 'van') {
      setSelectedVehicle(vehicleParam);
    }
  }, []);

  const handleVehicleSelect = (vehicleType: 'truck' | 'van') => {
    setSelectedVehicle(vehicleType);
    // Оновлюємо URL без перезавантаження сторінки
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('vehicle', vehicleType);
    window.history.pushState({}, '', newUrl);
  };

  const handleBack = () => {
    setSelectedVehicle(null);
    // Видаляємо параметр з URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('vehicle');
    window.history.pushState({}, '', newUrl);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <div className="finance-modal" style={{ 
          position: 'relative', 
          width: '100%', 
          maxHeight: 'none', 
          overflow: 'visible',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        }}>
          <div className="finance-modal-header">
            <h2>💰 Фінансові розрахунки для вантажних перевезень</h2>
            <button 
              className="finance-modal-close" 
              onClick={() => window.close()}
              title="Закрити вікно"
            >
              ✕
            </button>
          </div>

          {!selectedVehicle ? (
            <div className="finance-vehicle-selection">
              <h3>Оберіть тип транспорту для детального розрахунку витрат:</h3>
              <div className="finance-vehicle-cards">
                <div 
                  className="finance-vehicle-card"
                  onClick={() => handleVehicleSelect('truck')}
                >
                  <div className="finance-vehicle-icon">🚛</div>
                  <h4>Вантажівка</h4>
                  <p>Розрахунок витрат для великовантажного транспорту</p>
                  <ul>
                    <li>Вантажопідйомність: до 24т</li>
                    <li>Об'єм: до 120м³</li>
                    <li>Міжнародні перевезення</li>
                    <li>Дальні маршрути</li>
                  </ul>
                </div>

                <div 
                  className="finance-vehicle-card"
                  onClick={() => handleVehicleSelect('van')}
                >
                  <div className="finance-vehicle-icon">🚐</div>
                  <h4>Бус 3.5т</h4>
                  <p>Розрахунок витрат для легкого комерційного транспорту</p>
                  <ul>
                    <li>Вантажопідйомність: до 3.5т</li>
                    <li>Об'єм: до 20м³</li>
                    <li>Міські та регіональні перевезення</li>
                    <li>Швидка доставка</li>
                  </ul>
                </div>
              </div>
              
              <div style={{ 
                textAlign: 'center', 
                marginTop: '32px', 
                padding: '24px', 
                background: '#e8f5e8', 
                borderRadius: '12px',
                border: '1px solid #4CAF50'
              }}>
                <h4 style={{ margin: '0 0 12px', color: '#2d5016' }}>
                  📊 Що включає розрахунок:
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '16px', 
                  textAlign: 'left',
                  fontSize: '0.9rem'
                }}>
                  <div>
                    <strong>Базові витрати для запуску:</strong>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                      <li>Придбання транспорту</li>
                      <li>Страхування</li>
                      <li>Ліцензії та дозволи</li>
                      <li>Початкове обладнання</li>
                    </ul>
                  </div>
                  <div>
                    <strong>Змінні витрати (детально):</strong>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                      <li>Паливо та витрата</li>
                      <li>Зарплата водія</li>
                      <li>ТО та ремонт</li>
                      <li>Шини та дорожні збори</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="finance-calculator-container">
              <div className="finance-calculator-header">
                <button className="finance-back-btn" onClick={handleBack}>
                  ← Назад до вибору
                </button>
                <h3>
                  {selectedVehicle === 'truck' ? '🚛 Розрахунок для вантажівки' : '🚐 Розрахунок для буса 3.5т'}
                </h3>
              </div>
              
              {selectedVehicle === 'truck' ? (
                <TruckFinanceCalculator />
              ) : (
                <VanFinanceCalculator />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}