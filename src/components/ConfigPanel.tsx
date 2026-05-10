import { useState, useEffect } from 'react';
import { MapModal } from './MapModal';
import { reverseGeocode } from '../utils/geocode';
import { getAvailableStrategies, getStrategyInfo, RouteStrategy, legacyToStrategy, strategyToLegacy } from '../utils/routeStrategy';
import type { RouteConfig, WayPoint } from '../types';

interface ConfigPanelProps {
  config: RouteConfig;
  onChange: (config: RouteConfig) => void;
  onFetch: () => void;
  loading: boolean;
}

// Local storage key
const CONFIG_STORAGE_KEY = 'larry-route-planner-config';

// Save config to localStorage
function saveConfig(config: RouteConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn('Failed to save config to localStorage:', error);
  }
}

// Load config from localStorage
function loadConfig(): Partial<RouteConfig> | null {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn('Failed to load config from localStorage:', error);
    return null;
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function WayPointEditor({
  point,
  onChange,
  onRemove,
  onPickMap,
  canRemove,
  label,
}: {
  point: WayPoint;
  onChange: (p: WayPoint) => void;
  onRemove: () => void;
  onPickMap: () => void;
  canRemove: boolean;
  label: string;
}) {
  const update = (field: keyof WayPoint, value: string | number) => {
    onChange({ ...point, [field]: value });
  };

  return (
    <div className="waypoint-card">
      <div className="waypoint-header">
        <span className="waypoint-label">{label}</span>
        <div className="waypoint-actions">
          <button
            className="pick-map-btn"
            onClick={onPickMap}
            title="Pick on map"
          >
            🗺️
          </button>
          {canRemove && (
            <button
              className="remove-btn"
              onClick={onRemove}
              title="Remove point"
              aria-label={`Remove ${label}`}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>City</label>
          <input
            type="text"
            value={point.locality}
            onChange={(e) => update('locality', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Postal Code</label>
          <input
            type="text"
            value={point.postalCode}
            onChange={(e) => update('postalCode', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Country</label>
          <input
            type="text"
            value={point.country}
            onChange={(e) => update('country', e.target.value)}
          />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Lat</label>
          <input
            type="number"
            step="0.000001"
            value={point.latitude}
            onChange={(e) =>
              update('latitude', parseFloat(e.target.value) || 0)
            }
          />
        </div>
        <div className="field">
          <label>Lon</label>
          <input
            type="number"
            step="0.000001"
            value={point.longitude}
            onChange={(e) =>
              update('longitude', parseFloat(e.target.value) || 0)
            }
          />
        </div>
        <div className="field">
          <label>Range (km)</label>
          <input
            type="number"
            value={point.range}
            onChange={(e) =>
              update('range', parseInt(e.target.value) || 0)
            }
          />
        </div>
      </div>
    </div>
  );
}

export function ConfigPanel({
  config,
  onChange,
  onFetch,
  loading,
}: ConfigPanelProps) {
  const [mapModal, setMapModal] = useState<{
    type: 'loading' | 'unloading' | 'home';
    index: number | null; // null = adding new point
    initialLat?: number;
    initialLon?: number;
  } | null>(null);

  // Collapsible sections state - всі розділи за замовчуванням закриті
  const [collapsed, setCollapsed] = useState({
    api: true,
    loading: true,
    unloading: true,
    filters: true,
    optimization: true,
    homebase: true,
    dates: true,
    earnings: true,
  });

  // State for tracking auto-corrected dates
  const [autoCorrections, setAutoCorrections] = useState<{
    departureTo?: boolean;
    returnTo?: boolean;
  }>({});

  // Load saved config on mount
  useEffect(() => {
    const savedConfig = loadConfig();
    if (savedConfig) {
      onChange({ ...config, ...savedConfig });
    }
  }, []);

  // Save config whenever it changes
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const toggleSection = (section: keyof typeof collapsed) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateField = (
    field: keyof RouteConfig,
    value: string | number | boolean
  ) => {
    // Save bearerToken to localStorage when it changes
    if (field === 'bearerToken' && typeof value === 'string') {
      try {
        if (value.trim()) {
          localStorage.setItem('transFrameToken', value);
        } else {
          localStorage.removeItem('transFrameToken');
        }
      } catch (error) {
        console.warn('Failed to save transFrameToken to localStorage:', error);
      }
    }
    
    let newConfig = { ...config, [field]: value };
    let newCorrections = { ...autoCorrections };
    
    // Auto-validate date ranges
    if (field === 'departureFrom' || field === 'departureTo') {
      const depFrom = field === 'departureFrom' ? value as string : config.departureFrom;
      const depTo = field === 'departureTo' ? value as string : config.departureTo;
      
      // If departure from is later than departure to, adjust departure to
      if (depFrom && depTo && depFrom > depTo) {
        newConfig.departureTo = depFrom;
        newCorrections.departureTo = true;
        console.log('Larry: Auto-adjusted Departure To to match Departure From:', depFrom);
        
        // Clear the correction indicator after 3 seconds
        setTimeout(() => {
          setAutoCorrections(prev => ({ ...prev, departureTo: false }));
        }, 3000);
      } else {
        newCorrections.departureTo = false;
      }
      
      // Also check if return dates need adjustment when departure changes
      if (field === 'departureFrom') {
        const retFrom = config.returnFrom;
        if (retFrom && depFrom && retFrom < depFrom) {
          newConfig.returnFrom = depFrom;
          console.log('Larry: Auto-adjusted Return From to not be earlier than Departure From:', depFrom);
        }
      }
    }
    
    if (field === 'returnFrom' || field === 'returnTo') {
      const retFrom = field === 'returnFrom' ? value as string : config.returnFrom;
      const retTo = field === 'returnTo' ? value as string : config.returnTo;
      
      // If return from is later than return to, adjust return to
      if (retFrom && retTo && retFrom > retTo) {
        newConfig.returnTo = retFrom;
        newCorrections.returnTo = true;
        console.log('Larry: Auto-adjusted Return To to match Return From:', retFrom);
        
        // Clear the correction indicator after 3 seconds
        setTimeout(() => {
          setAutoCorrections(prev => ({ ...prev, returnTo: false }));
        }, 3000);
      } else {
        newCorrections.returnTo = false;
      }
      
      // Ensure return from is not earlier than departure from
      if (field === 'returnFrom') {
        const depFrom = config.departureFrom;
        if (depFrom && retFrom && retFrom < depFrom) {
          newConfig.returnFrom = depFrom;
          console.log('Larry: Auto-adjusted Return From to not be earlier than Departure From:', depFrom);
        }
      }
    }
    
    setAutoCorrections(newCorrections);
    onChange(newConfig);
  };

  const addLoadingPoint = () => {
    const newPoint: WayPoint = {
      id: generateId(),
      locality: '',
      postalCode: '',
      country: '47_poland',
      latitude: 50.0,
      longitude: 20.0,
      range: 50,
    };
    
    // Also add corresponding unloading point
    const newUnloadingPoint: WayPoint = {
      id: generateId(),
      locality: '',
      postalCode: '',
      country: '21_germany',
      latitude: 52.0,
      longitude: 13.0,
      range: 50,
    };
    
    onChange({
      ...config,
      loadingPoints: [...config.loadingPoints, newPoint],
      unloadingPoints: [...config.unloadingPoints, newUnloadingPoint],
    });
  };

  const addUnloadingPoint = () => {
    const newPoint: WayPoint = {
      id: generateId(),
      locality: '',
      postalCode: '',
      country: '21_germany',
      latitude: 52.0,
      longitude: 13.0,
      range: 50,
    };
    
    // Also add corresponding loading point
    const newLoadingPoint: WayPoint = {
      id: generateId(),
      locality: '',
      postalCode: '',
      country: '47_poland',
      latitude: 50.0,
      longitude: 20.0,
      range: 50,
    };
    
    onChange({
      ...config,
      unloadingPoints: [...config.unloadingPoints, newPoint],
      loadingPoints: [...config.loadingPoints, newLoadingPoint],
    });
  };

  const updateLoadingPoint = (idx: number, point: WayPoint) => {
    const updated = [...config.loadingPoints];
    updated[idx] = point;
    const newConfig = { ...config, loadingPoints: updated };
    
    // Auto-update home base if it matches the first loading point
    if (idx === 0 && config.homeBase.id === config.loadingPoints[0]?.id) {
      newConfig.homeBase = { ...point };
    }
    
    onChange(newConfig);
  };

  const updateUnloadingPoint = (idx: number, point: WayPoint) => {
    const updated = [...config.unloadingPoints];
    updated[idx] = point;
    onChange({ ...config, unloadingPoints: updated });
  };

  const removeLoadingPoint = (idx: number) => {
    const updated = config.loadingPoints.filter((_, i) => i !== idx);
    // Also remove corresponding unloading point if exists
    const updatedUnloading = config.unloadingPoints.filter((_, i) => i !== idx);
    onChange({ 
      ...config, 
      loadingPoints: updated,
      unloadingPoints: updatedUnloading.length > 0 ? updatedUnloading : config.unloadingPoints
    });
  };

  const removeUnloadingPoint = (idx: number) => {
    const updated = config.unloadingPoints.filter((_, i) => i !== idx);
    // Also remove corresponding loading point if exists
    const updatedLoading = config.loadingPoints.filter((_, i) => i !== idx);
    onChange({ 
      ...config, 
      unloadingPoints: updated,
      loadingPoints: updatedLoading.length > 0 ? updatedLoading : config.loadingPoints
    });
  };

  const handleMapSelect = async (lat: number, lon: number) => {
    if (!mapModal) return;
    const geo = await reverseGeocode(lat, lon);

    if (mapModal.type === 'home') {
      // Update home base
      onChange({
        ...config,
        homeBase: {
          ...config.homeBase,
          latitude: lat,
          longitude: lon,
          locality: geo.locality || config.homeBase.locality,
          postalCode: geo.postalCode || config.homeBase.postalCode,
          country: geo.country || config.homeBase.country,
        }
      });
    } else if (mapModal.type === 'loading') {
      if (mapModal.index !== null) {
        // Update existing point
        const updated = [...config.loadingPoints];
        updated[mapModal.index] = {
          ...updated[mapModal.index],
          latitude: lat,
          longitude: lon,
          locality: geo.locality || updated[mapModal.index].locality,
          postalCode: geo.postalCode || updated[mapModal.index].postalCode,
          country: geo.country || updated[mapModal.index].country,
        };
        onChange({ ...config, loadingPoints: updated });
      } else {
        // Add new point
        const newPoint: WayPoint = {
          id: generateId(),
          locality: geo.locality,
          postalCode: geo.postalCode,
          country: geo.country,
          latitude: lat,
          longitude: lon,
          range: 50,
        };
        onChange({
          ...config,
          loadingPoints: [...config.loadingPoints, newPoint],
        });
      }
    } else {
      if (mapModal.index !== null) {
        const updated = [...config.unloadingPoints];
        updated[mapModal.index] = {
          ...updated[mapModal.index],
          latitude: lat,
          longitude: lon,
          locality: geo.locality || updated[mapModal.index].locality,
          postalCode: geo.postalCode || updated[mapModal.index].postalCode,
          country: geo.country || updated[mapModal.index].country,
        };
        onChange({ ...config, unloadingPoints: updated });
      } else {
        const newPoint: WayPoint = {
          id: generateId(),
          locality: geo.locality,
          postalCode: geo.postalCode,
          country: geo.country,
          latitude: lat,
          longitude: lon,
          range: 50,
        };
        onChange({
          ...config,
          unloadingPoints: [...config.unloadingPoints, newPoint],
        });
      }
    }

    setMapModal(null);
  };

  return (
    <div className="config-panel">
      <h2>🚛 Larry Route Planner</h2>

      <section className="config-section">
        <h3 onClick={() => toggleSection('api')} className="collapsible-header">
          API Connection
          <span className="collapse-icon">{collapsed.api ? '▶' : '▼'}</span>
        </h3>
        {!collapsed.api && (
          <div className="section-content">
        <div className="field">
          <label htmlFor="apiUrl">API URL</label>
          <input
            id="apiUrl"
            type="text"
            value={config.apiUrl}
            onChange={(e) => updateField('apiUrl', e.target.value)}
            placeholder="/api/trans/app/exchange/api/rest/v2/freight-offers"
          />
        </div>
        <div className="field">
          <label htmlFor="bearerToken">
            Bearer Token
            {config.bearerToken && (
              <span style={{ 
                fontSize: '0.75rem', 
                color: '#666', 
                marginLeft: '8px',
                fontWeight: 'normal'
              }}>
                {window.parent !== window 
                  ? '(з platform.trans.eu через extension)' 
                  : '(з localStorage)'
                }
              </span>
            )}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="bearerToken"
              type="password"
              value={config.bearerToken}
              onChange={(e) => updateField('bearerToken', e.target.value)}
              placeholder={window.parent !== window 
                ? "Автозавантаження з platform.trans.eu..." 
                : "Your API token (автозавантаження з localStorage)"
              }
              style={{
                flex: 1,
                borderColor: config.bearerToken && /[^\x00-\xFF]/.test(config.bearerToken) ? '#ff4444' : undefined
              }}
            />
            {!config.bearerToken && window.parent !== window && (
              <button
                type="button"
                onClick={() => {
                  console.log('Larry: Manually requesting token from extension...');
                  window.parent.postMessage({ type: 'REQUEST_TOKEN' }, '*');
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #4a90e2',
                  borderRadius: '4px',
                  background: '#4a90e2',
                  color: 'white',
                  cursor: 'pointer'
                }}
                title="Запросити токен з platform.trans.eu"
              >
                🔄 Запросити токен
              </button>
            )}
            {window.parent !== window && (
              <button
                type="button"
                onClick={() => {
                  console.log('Larry: Requesting filters from extension...');
                  window.parent.postMessage({ type: 'REQUEST_FILTERS' }, '*');
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #28a745',
                  borderRadius: '4px',
                  background: '#28a745',
                  color: 'white',
                  cursor: 'pointer',
                  marginLeft: '4px'
                }}
                title="Оновити фільтри з platform.trans.eu"
              >
                📥 Оновити фільтри
              </button>
            )}
            {config.bearerToken && (
              <button
                type="button"
                onClick={() => updateField('bearerToken', '')}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: '#f8f9fa',
                  cursor: 'pointer',
                  color: '#666'
                }}
                title="Очистити токен"
              >
                🗑️ Очистити
              </button>
            )}
            {config.bearerToken && /[^\x00-\xFF]/.test(config.bearerToken) && (
              <button
                type="button"
                onClick={() => updateField('bearerToken', config.bearerToken.replace(/[^\x00-\xFF]/g, '').trim())}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                title="Clean invalid characters from token"
              >
                Clean
              </button>
            )}
          </div>
          {config.bearerToken && /[^\x00-\xFF]/.test(config.bearerToken) && (
            <div className="error-text" style={{ color: '#ff4444', fontSize: '12px', marginTop: '4px' }}>
              ⚠️ Token contains invalid characters. Click "Clean" to remove them automatically.
            </div>
          )}
          <div className="help-text">
            <strong>How to get Bearer Token:</strong><br/>
            1. Open <a href="https://platform.trans.eu" target="_blank" rel="noopener">platform.trans.eu</a><br/>
            2. Login to your account<br/>
            3. Open Browser Dev Tools (F12)<br/>
            4. Go to Network tab<br/>
            5. Make any search on the platform<br/>
            6. Find API request to api-platform.trans.eu<br/>
            7. Copy "Authorization: Bearer xxx" token<br/>
            8. Paste the token (without "Bearer ") here<br/><br/>
            <strong>⚠️ CORS Issue Solutions:</strong><br/>
            • <strong>Option 1:</strong> Use Chrome Extension on platform.trans.eu (recommended)<br/>
            • <strong>Option 2:</strong> Run proxy server: <code>node proxy-server.js</code> in project folder<br/>
            • <strong>Option 3:</strong> Use direct API URL with valid token
          </div>
        </div>
        </div>
        )}
      </section>

      <section className="config-section">
        <h3 onClick={() => toggleSection('loading')} className="collapsible-header">
          📍 Loading Points (Pickup Locations)
          <span className="collapse-icon">{collapsed.loading ? '▶' : '▼'}</span>
          <div className="section-actions">
            <button
              className="add-btn"
              onClick={() =>
                setMapModal({ type: 'loading', index: null })
              }
              title="Pick on map"
            >
              🗺️ Map
            </button>
            <button className="add-btn" onClick={addLoadingPoint}>
              + Add
            </button>
          </div>
        </h3>
        {!collapsed.loading && (
          <div className="section-content">
        <div className="help-text">
          <strong>Loading Points:</strong> Intermediate locations where Larry can pick up cargo during the route.
          <br/><strong>Note:</strong> Adding a loading point automatically adds a corresponding unloading point.
        </div>
        {config.loadingPoints.map((point, idx) => (
          <WayPointEditor
            key={point.id}
            point={point}
            onChange={(p) => updateLoadingPoint(idx, p)}
            onRemove={() => removeLoadingPoint(idx)}
            onPickMap={() =>
              setMapModal({
                type: 'loading',
                index: idx,
                initialLat: point.latitude,
                initialLon: point.longitude,
              })
            }
            canRemove={config.loadingPoints.length > 1}
            label={`Loading #${idx + 1}`}
          />
        ))}
        </div>
        )}
      </section>

      <section className="config-section">
        <h3 onClick={() => toggleSection('unloading')} className="collapsible-header">
          📍 Unloading Points (Delivery Locations)
          <span className="collapse-icon">{collapsed.unloading ? '▶' : '▼'}</span>
          <div className="section-actions">
            <button
              className="add-btn"
              onClick={() =>
                setMapModal({ type: 'unloading', index: null })
              }
              title="Pick on map"
            >
              🗺️ Map
            </button>
            <button className="add-btn" onClick={addUnloadingPoint}>
              + Add
            </button>
          </div>
        </h3>
        {!collapsed.unloading && (
          <div className="section-content">
        <div className="help-text">
          <strong>Unloading Points:</strong> Intermediate locations where Larry can deliver cargo during the route.
          <br/><strong>Note:</strong> Adding an unloading point automatically adds a corresponding loading point.
        </div>
        {config.unloadingPoints.map((point, idx) => (
          <WayPointEditor
            key={point.id}
            point={point}
            onChange={(p) => updateUnloadingPoint(idx, p)}
            onRemove={() => removeUnloadingPoint(idx)}
            onPickMap={() =>
              setMapModal({
                type: 'unloading',
                index: idx,
                initialLat: point.latitude,
                initialLon: point.longitude,
              })
            }
            canRemove={config.unloadingPoints.length > 1}
            label={`Unloading #${idx + 1}`}
          />
        ))}
        </div>
        )}
      </section>

      <section className="config-section">
        <h3 onClick={() => toggleSection('homebase')} className="collapsible-header">
          🏠 Home Base (Start/End Point)
          <span className="collapse-icon">{collapsed.homebase ? '▶' : '▼'}</span>
        </h3>
        {!collapsed.homebase && (
          <div className="section-content">
        <div className="help-text">
          <strong>Home Base:</strong> The starting and ending point of all routes. 
          Larry will depart from here and must return here within the time window.
        </div>
        <div className="field checkbox-field">
          <label>
            <input
              type="checkbox"
              checked={config.homeBase.id === config.loadingPoints[0]?.id}
              onChange={(e) => {
                if (e.target.checked && config.loadingPoints.length > 0) {
                  onChange({ ...config, homeBase: { ...config.loadingPoints[0] } });
                }
              }}
            />
            Use first loading point as home base
          </label>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Home City</label>
            <input
              type="text"
              value={config.homeBase.locality}
              onChange={(e) => 
                onChange({ 
                  ...config, 
                  homeBase: { ...config.homeBase, locality: e.target.value }
                })
              }
            />
          </div>
          <div className="field">
            <label>Home Lat</label>
            <input
              type="number"
              step="0.000001"
              value={config.homeBase.latitude}
              onChange={(e) =>
                onChange({ 
                  ...config, 
                  homeBase: { ...config.homeBase, latitude: parseFloat(e.target.value) || 0 }
                })
              }
            />
          </div>
          <div className="field">
            <label>Home Lon</label>
            <input
              type="number"
              step="0.000001"
              value={config.homeBase.longitude}
              onChange={(e) =>
                onChange({ 
                  ...config, 
                  homeBase: { ...config.homeBase, longitude: parseFloat(e.target.value) || 0 }
                })
              }
            />
          </div>
        </div>
        <div className="field">
          <button
            className="pick-map-btn"
            onClick={() =>
              setMapModal({
                type: 'home',
                index: null,
                initialLat: config.homeBase.latitude,
                initialLon: config.homeBase.longitude,
              })
            }
            title="Pick home base on map"
            style={{ width: '100%', padding: '8px' }}
          >
            🗺️ Pick Home Base on Map
          </button>
        </div>
        </div>
        )}
      </section>

      <section className="config-section">
        <h3 onClick={() => toggleSection('filters')} className="collapsible-header">
          ⚙️ Filter Parameters
          <span className="collapse-icon">{collapsed.filters ? '▶' : '▼'}</span>
        </h3>
        {!collapsed.filters && (
          <div className="section-content">
        <div className="field-row">
          <div className="field">
            <label htmlFor="minWeight">Min Weight (t)</label>
            <input
              id="minWeight"
              type="number"
              value={config.minWeight}
              onChange={(e) =>
                updateField('minWeight', parseInt(e.target.value) || 0)
              }
              placeholder="0"
            />
            <div className="help-text">Мінімальна вага вантажу</div>
          </div>
          <div className="field">
            <label htmlFor="maxWeight">Max Weight (t)</label>
            <input
              id="maxWeight"
              type="number"
              value={config.maxWeight || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : undefined;
                if (value !== undefined) {
                  updateField('maxWeight', value);
                } else {
                  // Handle undefined by creating a new config without maxWeight
                  const newConfig = { ...config };
                  delete newConfig.maxWeight;
                  onChange(newConfig);
                }
              }}
              placeholder="No limit"
            />
            <div className="help-text">Максимальна вага вантажу</div>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="minCapacity">Min Capacity (t)</label>
            <input
              id="minCapacity"
              type="number"
              value={config.minCapacity}
              onChange={(e) =>
                updateField('minCapacity', parseInt(e.target.value) || 0)
              }
              placeholder="0"
            />
            <div className="help-text">Мінімальна вантажопідйомність транспорту</div>
          </div>
          <div className="field">
            <label htmlFor="maxCapacity">Max Capacity (t)</label>
            <input
              id="maxCapacity"
              type="number"
              value={config.maxCapacity || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : undefined;
                if (value !== undefined) {
                  updateField('maxCapacity', value);
                } else {
                  // Handle undefined by creating a new config without maxCapacity
                  const newConfig = { ...config };
                  delete newConfig.maxCapacity;
                  onChange(newConfig);
                }
              }}
              placeholder="No limit"
            />
            <div className="help-text">Максимальна вантажопідйомність транспорту</div>
          </div>
        </div>
        </div>
        )}
      </section>

      <section className="config-section">
        <h3 onClick={() => toggleSection('optimization')} className="collapsible-header">
          🔄 Route Optimization
          <span className="collapse-icon">{collapsed.optimization ? '▶' : '▼'}</span>
        </h3>
        {!collapsed.optimization && (
          <div className="section-content">
        
        {/* Route Strategy Selection */}
        <div className="field">
          <label htmlFor="routeStrategy">🎯 Стратегія оптимізації</label>
          <select
            id="routeStrategy"
            value={config.routeStrategy || legacyToStrategy(config.useAIOptimization)}
            onChange={(e) => {
              const newStrategy = e.target.value as RouteStrategy;
              updateField('routeStrategy', newStrategy);
              // Update legacy field for backward compatibility
              updateField('useAIOptimization', strategyToLegacy(newStrategy));
            }}
          >
            {getAvailableStrategies().map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.icon} {strategy.name}
              </option>
            ))}
          </select>
          
          {(() => {
            const currentStrategy = config.routeStrategy || legacyToStrategy(config.useAIOptimization);
            const strategyInfo = getStrategyInfo(currentStrategy as RouteStrategy);
            
            if (!strategyInfo) return null;
            
            return (
              <div className="strategy-info">
                <div className="help-text">{strategyInfo.description}</div>
                
                <div className="strategy-details">
                  <div className="pros-cons">
                    <div className="pros">
                      <strong>✅ Переваги:</strong>
                      <ul>
                        {strategyInfo.pros.map((pro, idx) => (
                          <li key={idx}>{pro}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="cons">
                      <strong>❌ Недоліки:</strong>
                      <ul>
                        {strategyInfo.cons.map((con, idx) => (
                          <li key={idx}>{con}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        
        {/* Legacy checkbox for backward compatibility */}
        <div className="field checkbox-field" style={{ display: 'none' }}>
          <label htmlFor="useAIOptimization">
            <input
              id="useAIOptimization"
              type="checkbox"
              checked={config.useAIOptimization}
              onChange={(e) => {
                updateField('useAIOptimization', e.target.checked);
                // Update new strategy field
                updateField('routeStrategy', legacyToStrategy(e.target.checked));
              }}
            />
            🤖 AI Оптимізація маршрутів (Legacy)
          </label>
        </div>
        
        {/* AI Configuration Section */}
        {(config.routeStrategy === RouteStrategy.AI_OPTIMIZATION || 
          (!config.routeStrategy && config.useAIOptimization)) && (
          <div className="ai-config-section">
            <div className="ai-status">
              {(() => {
                const hasGemini = typeof window !== 'undefined' && !!localStorage.getItem('GEMINI_API_KEY');
                const hasGroq = typeof window !== 'undefined' && !!localStorage.getItem('GROQ_API_KEY');
                const hasOpenAI = typeof window !== 'undefined' && !!localStorage.getItem('OPENAI_API_KEY');
                const hasClaude = typeof window !== 'undefined' && !!localStorage.getItem('CLAUDE_API_KEY');
                
                if (hasGemini) {
                  return <span className="status-good">🆓 Google Gemini підключено</span>;
                } else if (hasGroq) {
                  return <span className="status-good">🆓 Groq підключено</span>;
                } else if (hasOpenAI) {
                  return <span className="status-good">✅ OpenAI підключено</span>;
                } else if (hasClaude) {
                  return <span className="status-good">✅ Claude підключено</span>;
                } else {
                  return <span className="status-warning">⚠️ AI ключ не налаштовано. Додайте ключ в <code>src/config/aiConfig.ts</code></span>;
                }
              })()}
            </div>
            <div className="ai-instructions">
              <strong>🔧 Налаштування AI:</strong> Відредагуйте файл <code>src/config/aiConfig.ts</code><br/>
              <strong>🥇 Google Gemini (безкоштовно):</strong> <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Отримати ключ</a><br/>
              <strong>🥈 Groq (безкоштовно):</strong> <a href="https://console.groq.com" target="_blank" rel="noopener">Отримати ключ</a>
            </div>
          </div>
        )}
        
        <div className="field checkbox-field">
          <label htmlFor="includeReturnRoute">
            <input
              id="includeReturnRoute"
              type="checkbox"
              checked={config.includeReturnRoute}
              onChange={(e) =>
                updateField('includeReturnRoute', e.target.checked)
              }
            />
            Зворотня дорога (fetch reverse direction)
          </label>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="maxEmptyRunPercent">Max Empty (%)</label>
            <input
              id="maxEmptyRunPercent"
              type="number"
              value={config.maxEmptyRunPercent}
              onChange={(e) =>
                updateField(
                  'maxEmptyRunPercent',
                  parseInt(e.target.value) || 0
                )
              }
            />
          </div>
          <div className="field">
            <label htmlFor="averageSpeedKmh">Середня швидкість (км/год)</label>
            <input
              id="averageSpeedKmh"
              type="number"
              value={config.averageSpeedKmh}
              onChange={(e) =>
                updateField(
                  'averageSpeedKmh',
                  parseInt(e.target.value) || 80
                )
              }
              placeholder="80"
            />
            <div className="help-text">Для розрахунку часу в дорозі та EU норм</div>
          </div>
        </div>
        </div>
        )}
      </section>

      <section className="config-section">
        <h3 onClick={() => toggleSection('dates')} className="collapsible-header">
          📅 Departure & Return
          <span className="collapse-icon">{collapsed.dates ? '▶' : '▼'}</span>
        </h3>
        {!collapsed.dates && (
          <div className="section-content">
        <div className="field-row">
          <div className="field">
            <label htmlFor="departureFrom">Departure from</label>
            <input
              id="departureFrom"
              type="date"
              value={config.departureFrom}
              onChange={(e) => updateField('departureFrom', e.target.value)}
              title="Дата початку періоду відправлення. Якщо буде пізніше ніж 'Departure to', то 'Departure to' автоматично зміниться"
            />
          </div>
          <div className="field">
            <label htmlFor="departureTo">
              Departure to
              {autoCorrections.departureTo && (
                <span style={{ 
                  color: '#f39c12', 
                  fontSize: '0.7rem', 
                  marginLeft: '4px',
                  fontWeight: 'normal'
                }}>
                  (автоматично скориговано)
                </span>
              )}
            </label>
            <input
              id="departureTo"
              type="date"
              value={config.departureTo}
              onChange={(e) => updateField('departureTo', e.target.value)}
              title="Дата кінця періоду відправлення. Автоматично коригується якщо менша за 'Departure from'"
              style={{
                borderColor: autoCorrections.departureTo ? '#f39c12' : undefined,
                boxShadow: autoCorrections.departureTo ? '0 0 0 2px rgba(243, 156, 18, 0.2)' : undefined
              }}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="returnFrom">Return from</label>
            <input
              id="returnFrom"
              type="date"
              value={config.returnFrom}
              onChange={(e) => updateField('returnFrom', e.target.value)}
              title="Дата початку періоду повернення. Якщо буде пізніше ніж 'Return to', то 'Return to' автоматично зміниться"
            />
          </div>
          <div className="field">
            <label htmlFor="returnTo">
              Return to
              {autoCorrections.returnTo && (
                <span style={{ 
                  color: '#f39c12', 
                  fontSize: '0.7rem', 
                  marginLeft: '4px',
                  fontWeight: 'normal'
                }}>
                  (автоматично скориговано)
                </span>
              )}
            </label>
            <input
              id="returnTo"
              type="date"
              value={config.returnTo}
              onChange={(e) => updateField('returnTo', e.target.value)}
              title="Дата кінця періоду повернення. Автоматично коригується якщо менша за 'Return from'"
              style={{
                borderColor: autoCorrections.returnTo ? '#f39c12' : undefined,
                boxShadow: autoCorrections.returnTo ? '0 0 0 2px rgba(243, 156, 18, 0.2)' : undefined
              }}
            />
          </div>
        </div>
        </div>
        )}
      </section>

      <section className="config-section">
        <h3 onClick={() => toggleSection('earnings')} className="collapsible-header">
          💰 Earnings Calculation
          <span className="collapse-icon">{collapsed.earnings ? '▶' : '▼'}</span>
        </h3>
        {!collapsed.earnings && (
          <div className="section-content">
        <div className="field">
          <label htmlFor="pricePerKm">Price per km (EUR)</label>
          <input
            id="pricePerKm"
            type="number"
            step="0.1"
            value={config.pricePerKm}
            onChange={(e) =>
              updateField(
                'pricePerKm',
                parseFloat(e.target.value) || 1.5
              )
            }
            placeholder="1.5"
          />
          <div className="help-text">Used to calculate estimated earnings (loaded km × price per km)</div>
        </div>
        </div>
        )}
      </section>

      <button className="fetch-btn" onClick={onFetch} disabled={loading}>
        {loading ? '⏳ Loading...' : '🔍 Fetch & Optimize Routes'}
      </button>

      {mapModal && (
        <MapModal
          open={true}
          onClose={() => setMapModal(null)}
          onSelect={handleMapSelect}
          title={
            mapModal.type === 'home'
              ? 'Select Home Base location'
              : mapModal.index !== null
              ? `Move ${mapModal.type} point #${mapModal.index + 1}`
              : `Add new ${mapModal.type} point`
          }
          initialLat={mapModal.initialLat}
          initialLon={mapModal.initialLon}
        />
      )}
    </div>
  );
}