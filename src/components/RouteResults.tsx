import { useState } from 'react';
import type { OptimizedRoute, RouteSegment, WayPoint } from '../types';
import { RouteMapModal } from './RouteMapModal';
import { EU_DRIVING_RULES } from '../utils/euRules';

interface RouteResultsProps {
  routes: OptimizedRoute[];
  homeBase: WayPoint;
  pricePerKm: number; // EUR per km for earnings calculation
}

const DAY_NAMES = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_COLORS = [
  '#e74c3c', // Нд - red
  '#3498db', // Пн - blue
  '#2ecc71', // Вт - green
  '#f39c12', // Ср - orange
  '#9b59b6', // Чт - purple
  '#1abc9c', // Пт - teal
  '#e67e22', // Сб - dark orange
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDayOfWeek(dateStr: string): { name: string; color: string } {
  const d = new Date(dateStr);
  const dayIdx = d.getDay(); // 0=Sun, 1=Mon...
  return { name: DAY_NAMES[dayIdx], color: DAY_COLORS[dayIdx] };
}

function formatPrice(seg: RouteSegment): string {
  const price = seg.offer.price;
  if (!price.value) return '—';
  const currency = price.currency.replace(/^\d+_/, '').toUpperCase();
  return `${price.value} ${currency}`;
}

export function RouteResults({ routes, homeBase, pricePerKm }: RouteResultsProps) {
  const [mapRouteIdx, setMapRouteIdx] = useState<number | null>(null);
  const [euDetailIdx, setEuDetailIdx] = useState<number | null>(null);
  const [hideEuWarnings, setHideEuWarnings] = useState(false);

  if (routes.length === 0) {
    return null;
  }

  // Sort routes: most loaded km first, then least empty km
  const sortedRoutes = [...routes].sort((a, b) => {
    if (b.loadedDistanceKm !== a.loadedDistanceKm) {
      return b.loadedDistanceKm - a.loadedDistanceKm;
    }
    return a.emptyDistanceKm - b.emptyDistanceKm;
  });

  // Filter EU warnings if checkbox is checked
  const filteredRoutes = hideEuWarnings 
    ? sortedRoutes.filter(r => r.euCompliant) 
    : sortedRoutes;

  // Get detailed EU violations for a route
  function getEUViolations(route: OptimizedRoute): { rule: string; actual: string; limit: string; severity: 'warning' | 'critical' }[] {
    const violations: { rule: string; actual: string; limit: string; severity: 'warning' | 'critical' }[] = [];
    
    const weeks = Math.ceil(route.totalDays / 7);
    const avgWeeklyDriving = route.totalDrivingHours / weeks;
    const avgDailyDriving = route.totalDrivingHours / Math.max(route.totalDays, 1);
    
    // Check daily driving limit
    if (avgDailyDriving > EU_DRIVING_RULES.maxDailyDrivingHours) {
      violations.push({
        rule: `Середнє водіння на день > ${EU_DRIVING_RULES.maxDailyDrivingHours}h`,
        actual: `${avgDailyDriving.toFixed(1)}h/день`,
        limit: `Макс ${EU_DRIVING_RULES.maxDailyDrivingHours}h (або ${EU_DRIVING_RULES.maxExtendedDailyDrivingHours}h 2× на тиждень)`,
        severity: avgDailyDriving > EU_DRIVING_RULES.maxExtendedDailyDrivingHours ? 'critical' : 'warning'
      });
    }
    
    // Check weekly driving limit
    if (avgWeeklyDriving > EU_DRIVING_RULES.maxWeeklyDrivingHours) {
      violations.push({
        rule: `Тижневе водіння > ${EU_DRIVING_RULES.maxWeeklyDrivingHours}h`,
        actual: `${avgWeeklyDriving.toFixed(1)}h/тиждень`,
        limit: `Макс ${EU_DRIVING_RULES.maxWeeklyDrivingHours}h на тиждень`,
        severity: 'critical'
      });
    }
    
    // Check bi-weekly limit
    if (weeks >= 2) {
      const biWeeklyDriving = route.totalDrivingHours / Math.ceil(weeks / 2);
      if (biWeeklyDriving > EU_DRIVING_RULES.maxBiWeeklyDrivingHours) {
        violations.push({
          rule: `Двотижневе водіння > ${EU_DRIVING_RULES.maxBiWeeklyDrivingHours}h`,
          actual: `${biWeeklyDriving.toFixed(1)}h / 2 тижні`,
          limit: `Макс ${EU_DRIVING_RULES.maxBiWeeklyDrivingHours}h за 2 послідовні тижні`,
          severity: 'critical'
        });
      }
    }
    
    // Check continuous driving segments
    const longSegments = route.segments.filter(s => s.drivingHours > EU_DRIVING_RULES.maxContinuousDrivingHours);
    if (longSegments.length > 0) {
      violations.push({
        rule: `Безперервне водіння > ${EU_DRIVING_RULES.maxContinuousDrivingHours}h`,
        actual: `${longSegments.length} сегмент(ів) перевищують ліміт`,
        limit: `Макс ${EU_DRIVING_RULES.maxContinuousDrivingHours}h, потім перерва ${EU_DRIVING_RULES.minBreakMinutes} хв`,
        severity: 'warning'
      });
    }
    
    // Check if enough rest days
    if (route.totalDays > EU_DRIVING_RULES.maxDaysBeforeWeeklyRest && route.weeklyRestsNeeded === 0) {
      violations.push({
        rule: `Більше ${EU_DRIVING_RULES.maxDaysBeforeWeeklyRest} днів без тижневого відпочинку`,
        actual: `${route.totalDays.toFixed(1)} днів`,
        limit: `Тижневий відпочинок ${EU_DRIVING_RULES.minWeeklyRestHours}h після ${EU_DRIVING_RULES.maxDaysBeforeWeeklyRest} днів`,
        severity: 'critical'
      });
    }
    
    return violations;
  }

  return (
    <div className="route-results">
      <h3>🏆 Optimized Routes for Larry ({filteredRoutes.length} found)</h3>
      <p className="hint">
        Routes start and end at <strong>Home Base</strong>. Loading/Unloading points are intermediate stops.
        Routes ranked by score: More loaded km + less empty runs + less idle + EU compliant = better.
      </p>

      <div className="route-filters">
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={hideEuWarnings}
            onChange={(e) => setHideEuWarnings(e.target.checked)}
          />
          Сховати маршрути з EU Warning ({routes.length - routes.filter(r => r.euCompliant).length} шт)
        </label>
      </div>

      {filteredRoutes.map((route, routeIdx) => (
        <div
          key={routeIdx}
          className={`route-card ${route.euCompliant ? 'eu-ok' : 'eu-warn'}`}
        >
          <div className="route-header">
            <h4>
              Route #{routeIdx + 1}{' '}
              <span className="score">
                Score: {route.score.toFixed(0)}
              </span>
              <span
                className={`eu-badge ${route.euCompliant ? 'compliant' : 'non-compliant'}`}
                onClick={() => setEuDetailIdx(euDetailIdx === routeIdx ? null : routeIdx)}
                style={{ cursor: 'pointer' }}
                title="Натисніть для деталей"
              >
                {route.euCompliant ? '🇪🇺 EU OK' : '⚠️ EU Warning'}
              </span>
              {route.timeOverlap && (
                <span 
                  className="eu-badge" 
                  style={{ background: '#f6e05e', color: '#744210' }}
                  title="Час завантаження/розвантаження може накладатися — потрібно узгодити з перевізником"
                >
                  ⏰ Час гнучкий
                </span>
              )}
              {/* Check if this is a cyclic route (same offer repeated) */}
              {route.segments.length > 1 && 
               route.segments.every(seg => seg.offer.id === route.segments[0].offer.id) && (
                <span className="cycle-badge">
                  🔄 Cycle x{route.segments.length}
                </span>
              )}
              <button
                className="show-map-btn"
                onClick={() => setMapRouteIdx(routeIdx)}
                title="Показати маршрут на карті"
              >
                🗺 На карті
              </button>
            </h4>
            
            {/* EU Compliance Details Popup */}
            {euDetailIdx === routeIdx && (
              <div className="eu-details-popup">
                <div className="eu-details-header">
                  <strong>🇪🇺 Деталі відповідності EU (EC 561/2006)</strong>
                  <button className="eu-details-close" onClick={() => setEuDetailIdx(null)}>✕</button>
                </div>
                <div className="eu-details-stats">
                  <div className="eu-stat-row">
                    <span>🚗 Загальне водіння:</span>
                    <span className={route.totalDrivingHours / Math.max(route.totalDays, 1) > EU_DRIVING_RULES.maxDailyDrivingHours ? 'eu-stat-bad' : 'eu-stat-ok'}>
                      {route.totalDrivingHours.toFixed(1)}h ({(route.totalDrivingHours / Math.max(route.totalDays, 1)).toFixed(1)}h/день)
                    </span>
                  </div>
                  <div className="eu-stat-row">
                    <span>📅 Тривалість:</span>
                    <span>{route.totalDays.toFixed(1)} днів</span>
                  </div>
                  <div className="eu-stat-row">
                    <span>☕ Обов'язкові перерви:</span>
                    <span>{route.mandatoryBreaks} × {EU_DRIVING_RULES.minBreakMinutes} хв</span>
                  </div>
                  <div className="eu-stat-row">
                    <span>🛏️ Тижневий відпочинок:</span>
                    <span>{route.weeklyRestsNeeded} × {EU_DRIVING_RULES.minWeeklyRestHours}h</span>
                  </div>
                </div>
                
                {!route.euCompliant && (
                  <div className="eu-violations">
                    <strong style={{ color: '#c0392b' }}>⚠️ Порушення:</strong>
                    {getEUViolations(route).map((v, i) => (
                      <div key={i} className={`eu-violation-item ${v.severity}`}>
                        <div className="eu-violation-rule">{v.rule}</div>
                        <div className="eu-violation-detail">
                          <span className="eu-violation-actual">Факт: {v.actual}</span>
                          <span className="eu-violation-limit">Ліміт: {v.limit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {route.euCompliant && (
                  <div className="eu-compliant-msg">
                    ✅ Маршрут відповідає всім вимогам EC 561/2006
                  </div>
                )}
                
                <div className="eu-details-rules">
                  <small>
                    <strong>Основні правила:</strong> Макс {EU_DRIVING_RULES.maxDailyDrivingHours}h/день • 
                    Перерва {EU_DRIVING_RULES.minBreakMinutes}хв кожні {EU_DRIVING_RULES.maxContinuousDrivingHours}h • 
                    Відпочинок {EU_DRIVING_RULES.minDailyRestHours}h/добу • 
                    Макс {EU_DRIVING_RULES.maxWeeklyDrivingHours}h/тиждень
                  </small>
                </div>
              </div>
            )}
            
            <div className="route-stats">
              <span className="stat">
                📏 Total: {route.totalDistanceKm.toFixed(0)} km
              </span>
              <span className="stat loaded">
                📦 Loaded: {route.loadedDistanceKm.toFixed(0)} km
              </span>
              <span className="stat empty">
                🚫 Empty: {route.emptyDistanceKm.toFixed(0)} km (
                {route.emptyRunPercent.toFixed(1)}%)
              </span>
              <span className="stat">
                💰 Earnings: ~{(route.loadedDistanceKm * pricePerKm).toFixed(0)} EUR
                ({(route.loadedDistanceKm * pricePerKm / Math.max(route.totalDays, 1)).toFixed(0)} EUR/day)
              </span>
              <span className="stat">
                📅 Days: {route.totalDays.toFixed(1)}
              </span>
              <span className="stat">
                🚗 Driving: {route.totalDrivingHours.toFixed(1)}h
              </span>
              <span className="stat">
                🛏️ Rest: {route.totalRestHours.toFixed(1)}h
              </span>
              <span className="stat">
                ⏱️ Idle: {route.idleHours.toFixed(1)}h
              </span>
              <span className="stat">
                ☕ Breaks: {route.mandatoryBreaks}
              </span>
              <span className="stat">
                🔗 Segments: {route.segments.length}
              </span>
            </div>
          </div>

          <table className="segments-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Loading</th>
                <th>#</th>
                <th>Route</th>
                <th>Distance</th>
                <th>Price</th>
                <th>Driving</th>
                <th>Empty to reach</th>
                <th>Breaks</th>
                <th>Unloading</th>
                <th>Company</th>
              </tr>
            </thead>
            <tbody>
              {route.segments.map((seg, segIdx) => {
                const day = getDayOfWeek(seg.loadingDate);
                return (
                  <tr key={segIdx}>
                    <td>
                      <span
                        className="day-badge"
                        style={{ background: day.color }}
                      >
                        {day.name}
                      </span>
                    </td>
                    <td>{formatDate(seg.loadingDate)}</td>
                    <td>{segIdx + 1}</td>
                    <td>{seg.from} → {seg.to}</td>
                    <td>{seg.distanceKm.toFixed(0)} km</td>
                    <td className="price-cell">{formatPrice(seg)}</td>
                    <td>{seg.drivingHours.toFixed(1)}h</td>
                    <td
                      className={seg.emptyDistanceKm > 100 ? 'warn' : ''}
                    >
                      {seg.emptyDistanceKm.toFixed(0)} km
                    </td>
                    <td>{seg.restStops}</td>
                    <td>{formatDate(seg.unloadingDate)}</td>
                    <td>
                      <small>{seg.offer.company.legal_name}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {mapRouteIdx !== null && routes[mapRouteIdx] && (
        <RouteMapModal
          open={mapRouteIdx !== null}
          onClose={() => setMapRouteIdx(null)}
          route={routes[mapRouteIdx]}
          routeIndex={mapRouteIdx}
          homeBase={homeBase}
        />
      )}
    </div>
  );
}
