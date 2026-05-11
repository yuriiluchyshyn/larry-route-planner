import { useState } from 'react';
import { TruckFinanceCalculator } from './TruckFinanceCalculator';
import { VanFinanceCalculator } from './VanFinanceCalculator';
import './FinanceModal.css';

interface FinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FinanceModal({ isOpen, onClose }: FinanceModalProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<'truck' | 'van' | null>(null);

  if (!isOpen) return null;

  const handleVehicleSelect = (vehicleType: 'truck' | 'van') => {
    setSelectedVehicle(vehicleType);
  };

  const handleBack = () => {
    setSelectedVehicle(null);
  };

  return (
    <div className="finance-modal-overlay" onClick={onClose}>
      <div className="finance-modal" onClick={(e) => e.stopPropagation()}>
        <div className="finance-modal-header">
          <h2>💰 Фінансові розрахунки</h2>
          <button className="finance-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {!selectedVehicle ? (
          <div className="finance-vehicle-selection">
            <h3>Оберіть тип транспорту для розрахунку:</h3>
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
                </ul>
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
  );
}