/**
 * Search Progress Bar Component
 * Відображає прогрес пошуку маршрутів
 */

import React from 'react';

interface SearchProgressProps {
  current: number;
  total: number;
  currentRoute: string;
  phase: 'searching' | 'optimizing' | 'completed';
}

export function SearchProgressBar({ current, total, currentRoute, phase }: SearchProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  const getPhaseIcon = () => {
    switch (phase) {
      case 'searching':
        return '🔍';
      case 'optimizing':
        return '⚡';
      case 'completed':
        return '✅';
      default:
        return '🔄';
    }
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'searching':
        return '#3b82f6'; // blue
      case 'optimizing':
        return '#f59e0b'; // amber
      case 'completed':
        return '#10b981'; // green
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <div className="search-progress-container" style={{
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '16px',
      margin: '16px 0',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '12px',
        fontSize: '14px',
        fontWeight: '500',
        color: '#374151'
      }}>
        <span style={{ marginRight: '8px', fontSize: '16px' }}>
          {getPhaseIcon()}
        </span>
        <span>Прогрес пошуку маршрутів</span>
        <span style={{
          marginLeft: 'auto',
          color: '#6b7280',
          fontSize: '12px'
        }}>
          {current}/{total}
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: '#e5e7eb',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '8px'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: getPhaseColor(),
          borderRadius: '4px',
          transition: 'width 0.3s ease-in-out'
        }} />
      </div>

      {/* Current Route */}
      <div style={{
        fontSize: '13px',
        color: '#6b7280',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>{currentRoute}</span>
        <span style={{
          fontWeight: '600',
          color: getPhaseColor()
        }}>
          {percentage}%
        </span>
      </div>

      {/* Phase indicator */}
      {phase === 'searching' && (
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          Завантажуємо пропозиції для кожної комбінації маршрутів...
        </div>
      )}

      {phase === 'optimizing' && (
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          Аналізуємо та оптимізуємо знайдені маршрути...
        </div>
      )}

      {phase === 'completed' && (
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: '#10b981',
          fontWeight: '500'
        }}>
          Пошук завершено успішно!
        </div>
      )}
    </div>
  );
}

export default SearchProgressBar;