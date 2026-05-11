/**
 * Error Banner Component
 * Компонент для відображення помилок
 */

import React from 'react';

interface ErrorBannerProps {
  error: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error }) => {
  return (
    <div className="error-banner">
      ❌ {error}
      {error.includes('CORS') && (
        <div style={{ marginTop: '8px', fontSize: '0.85em' }}>
          <strong>💡 Рішення:</strong> Використовуйте Chrome Extension на platform.trans.eu 
          або переконайтеся, що bearer token правильний.
        </div>
      )}
    </div>
  );
};