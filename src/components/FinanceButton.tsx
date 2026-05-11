import { useState } from 'react';

interface FinanceButtonProps {
  className?: string;
}

export function FinanceButton({ className = '' }: FinanceButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleVehicleSelect = (vehicleType: 'truck' | 'van') => {
    // Відкриваємо фінансову сторінку в новій вкладці з параметром типу транспорту
    const financeUrl = `${window.location.origin}/finance.html?vehicle=${vehicleType}`;
    window.open(financeUrl, '_blank');
    setIsOpen(false);
  };

  const handleOpenFinance = () => {
    // Відкриваємо загальну фінансову сторінку
    const financeUrl = `${window.location.origin}/finance.html`;
    window.open(financeUrl, '_blank');
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="finance-button"
        title="Фінансові розрахунки"
      >
        💰 Фінанси
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop для закриття при кліку поза меню */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Випадаюче меню */}
          <div className="finance-dropdown">
            <button
              onClick={handleOpenFinance}
              className="finance-dropdown-item"
            >
              📊 Загальні розрахунки
            </button>
            <button
              onClick={() => handleVehicleSelect('truck')}
              className="finance-dropdown-item"
            >
              🚛 Розрахунок для вантажівки
            </button>
            <button
              onClick={() => handleVehicleSelect('van')}
              className="finance-dropdown-item"
            >
              🚐 Розрахунок для буса 3.5т
            </button>
          </div>
        </>
      )}
    </div>
  );
}