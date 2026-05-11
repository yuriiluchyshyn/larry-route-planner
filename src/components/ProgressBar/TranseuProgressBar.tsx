/**
 * Transeu Progress Bar Component
 * Компонент для відображення прогресу аналізу маршрутів
 */

import React from 'react';

export interface TranseuProgress {
  phase: string;
  completed: number;
  total: number;
  currentBatch?: number;
  totalBatches?: number;
  totalApiRequests?: number;
  completedApiRequests?: number;
}

interface TranseuProgressBarProps {
  progress: TranseuProgress;
}

export const TranseuProgressBar: React.FC<TranseuProgressBarProps> = ({ progress }) => {
  const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
  const apiProgressPercentage = progress.totalApiRequests && progress.totalApiRequests > 0 
    ? ((progress.completedApiRequests || 0) / progress.totalApiRequests) * 100 
    : 0;

  return (
    <div className="transeu-progress-container" style={{
      padding: '16px',
      margin: '16px 0',
      backgroundColor: '#f0f8ff',
      border: '1px solid #4CAF50',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '12px',
        fontSize: '16px',
        fontWeight: '600',
        color: '#2c5aa0'
      }}>
        <span style={{ marginRight: '8px' }}>🚛</span>
        Trans.eu Аналіз Маршрутів
      </div>
      
      <div style={{ 
        marginBottom: '8px',
        fontSize: '14px',
        color: '#555'
      }}>
        {progress.phase}
      </div>
      
      <div style={{
        width: '100%',
        height: '12px',
        backgroundColor: '#e0e0e0',
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: '12px'
      }}>
        <div style={{
          width: `${progressPercentage}%`,
          height: '100%',
          backgroundColor: '#4CAF50',
          transition: 'width 0.3s ease',
          borderRadius: '6px'
        }} />
      </div>
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '13px',
        color: '#666'
      }}>
        <div>
          <strong>Поточна фаза:</strong> {progress.completed} / {progress.total}
          {progress.currentBatch && progress.totalBatches && (
            <span style={{ marginLeft: '12px' }}>
              <strong>Batch:</strong> {progress.currentBatch}/{progress.totalBatches}
            </span>
          )}
        </div>
        <div style={{ 
          fontSize: '16px', 
          fontWeight: '600',
          color: '#2c5aa0'
        }}>
          {Math.round(progressPercentage)}%
        </div>
      </div>
      
      {progress.totalApiRequests && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#495057'
        }}>
          <strong>Загальний прогрес API запитів:</strong> {progress.completedApiRequests || 0} / {progress.totalApiRequests}
          <span style={{ marginLeft: '8px', color: '#28a745' }}>
            ({Math.round(apiProgressPercentage)}%)
          </span>
        </div>
      )}
    </div>
  );
};