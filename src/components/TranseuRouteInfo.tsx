import React from 'react';
import type { OptimizedRoute } from '../types';

interface TranseuRouteInfoProps {
  route: OptimizedRoute;
}

export const TranseuRouteInfo: React.FC<TranseuRouteInfoProps> = ({ route }) => {
  // Check if this route has Trans.eu data
  const hasTranseuData = route.totalTollEur !== undefined || 
                        route.totalFuelConsumption !== undefined || 
                        route.totalCo2Emissions !== undefined;

  if (!hasTranseuData) {
    return null;
  }

  return (
    <div className="transeu-route-info">
      <h4>🚛 Детальна інформація Trans.eu</h4>
      <div className="transeu-metrics">
        {route.totalTollEur !== undefined && (
          <div className="metric">
            <span className="label">💰 Платні дороги:</span>
            <span className="value">€{route.totalTollEur.toFixed(2)}</span>
          </div>
        )}
        
        {route.totalFuelConsumption !== undefined && (
          <div className="metric">
            <span className="label">⛽ Витрати палива:</span>
            <span className="value">{route.totalFuelConsumption.toFixed(1)} л</span>
          </div>
        )}
        
        {route.totalCo2Emissions !== undefined && (
          <div className="metric">
            <span className="label">🌱 Викиди CO₂:</span>
            <span className="value">{route.totalCo2Emissions.toFixed(1)} кг</span>
          </div>
        )}
      </div>
      
      {/* Segment-level details */}
      {route.segments.some(seg => seg.tollEur || seg.fuelConsumption || seg.co2Emissions) && (
        <details className="segment-details">
          <summary>Деталі по сегментах</summary>
          <div className="segments-table">
            <table>
              <thead>
                <tr>
                  <th>Маршрут</th>
                  <th>Відстань</th>
                  <th>Платні дороги</th>
                  <th>Паливо</th>
                  <th>CO₂</th>
                </tr>
              </thead>
              <tbody>
                {route.segments.map((segment, index) => (
                  <tr key={index}>
                    <td>{segment.from} → {segment.to}</td>
                    <td>{segment.distanceKm.toFixed(0)} км</td>
                    <td>
                      {segment.tollEur !== undefined 
                        ? `€${segment.tollEur.toFixed(2)}` 
                        : '-'
                      }
                    </td>
                    <td>
                      {segment.fuelConsumption !== undefined 
                        ? `${segment.fuelConsumption.toFixed(1)} л` 
                        : '-'
                      }
                    </td>
                    <td>
                      {segment.co2Emissions !== undefined 
                        ? `${segment.co2Emissions.toFixed(1)} кг` 
                        : '-'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      
      <style>{`
        .transeu-route-info {
          margin-top: 1rem;
          padding: 1rem;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 8px;
          border-left: 4px solid #007bff;
        }
        
        .transeu-route-info h4 {
          margin: 0 0 1rem 0;
          color: #495057;
          font-size: 1.1rem;
        }
        
        .transeu-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        
        .metric {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: white;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .metric .label {
          font-weight: 500;
          color: #6c757d;
        }
        
        .metric .value {
          font-weight: 600;
          color: #007bff;
        }
        
        .segment-details {
          margin-top: 1rem;
        }
        
        .segment-details summary {
          cursor: pointer;
          font-weight: 500;
          color: #495057;
          padding: 0.5rem 0;
        }
        
        .segment-details summary:hover {
          color: #007bff;
        }
        
        .segments-table {
          margin-top: 0.5rem;
          overflow-x: auto;
        }
        
        .segments-table table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .segments-table th,
        .segments-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
        }
        
        .segments-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #495057;
        }
        
        .segments-table tr:last-child td {
          border-bottom: none;
        }
        
        .segments-table tr:hover {
          background: #f8f9fa;
        }
        
        @media (max-width: 768px) {
          .transeu-metrics {
            grid-template-columns: 1fr;
          }
          
          .segments-table {
            font-size: 0.9rem;
          }
          
          .segments-table th,
          .segments-table td {
            padding: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
};