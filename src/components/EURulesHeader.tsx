import { useState } from 'react';
import { EU_DRIVING_RULES } from '../utils/euRules';

export function EURulesHeader() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="eu-rules-header">
      <div className="eu-rules-summary" onClick={() => setExpanded(!expanded)}>
        <span className="eu-flag">🇪🇺</span>
        <span className="eu-title">
          EU Driving Regulations (EC 561/2006)
        </span>
        <span className="eu-quick-stats">
          Max {EU_DRIVING_RULES.maxDailyDrivingHours}h/day driving •{' '}
          {EU_DRIVING_RULES.minDailyRestHours}h/day rest •{' '}
          {EU_DRIVING_RULES.maxContinuousDrivingHours}h max continuous •{' '}
          {EU_DRIVING_RULES.minBreakMinutes}min break •{' '}
          {EU_DRIVING_RULES.maxWeeklyDrivingHours}h/week max
        </span>
        <button className="eu-toggle" aria-label="Toggle EU rules details">
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="eu-rules-details">
          <div className="eu-rules-grid">
            <div className="eu-rule-group">
              <h4>🕐 Daily Driving</h4>
              <ul>
                <li>
                  Max <strong>{EU_DRIVING_RULES.maxDailyDrivingHours}h</strong>{' '}
                  per day
                </li>
                <li>
                  Can extend to{' '}
                  <strong>
                    {EU_DRIVING_RULES.maxExtendedDailyDrivingHours}h
                  </strong>{' '}
                  up to {EU_DRIVING_RULES.maxExtendedDaysPerWeek}× per week
                </li>
                <li>
                  Max continuous driving:{' '}
                  <strong>{EU_DRIVING_RULES.maxContinuousDrivingHours}h</strong>
                </li>
                <li>
                  Then mandatory break:{' '}
                  <strong>{EU_DRIVING_RULES.minBreakMinutes} min</strong>
                </li>
              </ul>
            </div>

            <div className="eu-rule-group">
              <h4>🌙 Daily Rest</h4>
              <ul>
                <li>
                  Min <strong>{EU_DRIVING_RULES.minDailyRestHours}h</strong>{' '}
                  uninterrupted rest per 24h
                </li>
                <li>
                  Can reduce to{' '}
                  <strong>{EU_DRIVING_RULES.minReducedDailyRestHours}h</strong>{' '}
                  up to {EU_DRIVING_RULES.maxReducedRestsPerWeek}× per week
                </li>
                <li>
                  Split rest allowed: 3h + 9h (in that order)
                </li>
              </ul>
            </div>

            <div className="eu-rule-group">
              <h4>📅 Weekly Limits</h4>
              <ul>
                <li>
                  Max <strong>{EU_DRIVING_RULES.maxWeeklyDrivingHours}h</strong>{' '}
                  driving per week
                </li>
                <li>
                  Max <strong>{EU_DRIVING_RULES.maxBiWeeklyDrivingHours}h</strong>{' '}
                  over any 2 consecutive weeks
                </li>
                <li>
                  Max{' '}
                  <strong>
                    {EU_DRIVING_RULES.maxDaysBeforeWeeklyRest} consecutive days
                  </strong>{' '}
                  before weekly rest
                </li>
              </ul>
            </div>

            <div className="eu-rule-group">
              <h4>🛏️ Weekly Rest</h4>
              <ul>
                <li>
                  Min <strong>{EU_DRIVING_RULES.minWeeklyRestHours}h</strong>{' '}
                  regular weekly rest
                </li>
                <li>
                  Can reduce to{' '}
                  <strong>
                    {EU_DRIVING_RULES.minReducedWeeklyRestHours}h
                  </strong>{' '}
                  (must compensate within 3 weeks)
                </li>
                <li>Weekly rest must start no later than end of 6th day</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
