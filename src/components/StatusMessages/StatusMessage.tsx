/**
 * Status Message Component
 * Компонент для відображення статусних повідомлень
 */

import React from 'react';

export type StatusType = 'success' | 'error' | 'info' | 'warning';

interface StatusMessageProps {
  message: string;
  type?: StatusType;
  className?: string;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({ 
  message, 
  type = 'info',
  className = ''
}) => {
  const getStatusClass = (type: StatusType): string => {
    switch (type) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getStatusType = (message: string): StatusType => {
    if (message.includes('✅')) return 'success';
    if (message.includes('❌')) return 'error';
    if (message.includes('⚠️')) return 'warning';
    return 'info';
  };

  const statusType = type === 'info' ? getStatusType(message) : type;
  const statusClass = `search-status ${getStatusClass(statusType)} ${className}`.trim();

  return (
    <div className={statusClass}>
      {message}
    </div>
  );
};