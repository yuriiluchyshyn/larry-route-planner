import { useState, useEffect } from 'react';
import { MapModal } from './MapModal';
import { VehicleTypesModal } from './VehicleTypesModal';
// import { reverseGeocode } from '../utils/geocode';
import { legacyToStrategy } from '../utils/routeStrategy';
import { isInExtensionContext, requestTokenFromExtension, requestFiltersFromExtension } from '../services/extensionService';
import type { RouteConfig, WayPoint } from '../types';
import { reverseGeocode } from '../utils/geocode';
import { convertApiCodesToVehicleTypes } from '../utils/vehicleTypeMapper';
import { getCurrentLocation, isGeolocationAvailable } from '../utils/geolocation';

interface ConfigPanelProps {
  config: RouteConfig | null;
  onChange: (config: RouteConfig) => void;
  onFetch: () => void;
  loading: boolean;
  extensionVehicleTypes?: string[];
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

// Функція для отримання читабельної назви країни
function getCountryDisplayName(countryCode: string): string {
  const countryMap: { [key: string]: string } = {
    '47_poland': 'Poland',
    '21_germany': 'Germany',
    '33_france': 'France',
    '42_czech_republic': 'Czech Republic',
    '43_austria': 'Austria',
    '421_slovakia': 'Slovakia',
    '36_hungary': 'Hungary',
    '39_italy': 'Italy',
    '34_spain': 'Spain',
    '31_netherlands': 'Netherlands',
    '32_belgium': 'Belgium',
    'PL': 'Poland',
    'DE': 'Germany',
    'FR': 'France',
    'CZ': 'Czech Republic',
    'AT': 'Austria',
    'SK': 'Slovakia',
    'HU': 'Hungary',
    'IT': 'Italy',
    'ES': 'Spain',
    'NL': 'Netherlands',
    'BE': 'Belgium'
  };
  
  return countryMap[countryCode] || countryCode;
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
  extensionVehicleTypes = []
}: ConfigPanelProps) {
  // Якщо конфігурації немає, показуємо повідомлення
  if (!config) {
    return (
      <div className="config-panel">
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: '#666',
          border: '2px dashed #ddd',
          borderRadius: '8px',
          margin: '20px'
        }}>
          <h3>⚡ Ініціалізація Larry Route Planner</h3>
          <p>🔄 Автоматичне завантаження конфігурації та токену з Chrome Extension...</p>
          <div style={{ marginTop: '16px', fontSize: '0.9em' }}>
            <p><strong>💡 Переконайтеся що:</strong></p>
            <ul style={{ textAlign: 'left', display: 'inline-block' }}>
              <li>Ви відкрили Larry через Chrome Extension на platform.trans.eu</li>
              <li>Ви увійшли в свій акаунт на platform.trans.eu</li>
              <li>Extension має доступ до токену автентифікації</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const [mapModal, setMapModal] = useState<{
    type: 'loading' | 'unloading' | 'home';
    index: number | null; // null = adding new point
    initialLat?: number;
    initialLon?: number;
  } | null>(null);

  const [vehicleTypesModal, setVehicleTypesModal] = useState(false);

  // Оновлюємо extensionVehicleTypes коли отримуємо нові дані
  useEffect(() => {
    if (extensionVehicleTypes.length > 0) {
      console.log('Larry: Updated extension vehicle types:', extensionVehicleTypes);
    }
  }, [extensionVehicleTypes]);

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

  // State for tracking auto-corrected dates - removed since we no longer use date ranges

  // Load saved config on mount
  useEffect(() => {
    const savedConfig = loadConfig();
    if (savedConfig) {
      onChange({ ...config, ...savedConfig });
    }
  }, []);

  // Auto-detect location if no home base is set
  useEffect(() => {
    const autoDetectLocation = async () => {
      // Перевіряємо чи вже є домашня база
      const hasHomeBase = config?.routes?.some(r => r.type === 'homePoint');
      
      if (!hasHomeBase && isGeolocationAvailable()) {
        try {
          console.log('🏠 No home base found, auto-detecting location...');
          const location = await getCurrentLocation();
          
          const geo = await reverseGeocode(location.latitude, location.longitude);
          
          const newHomePoint = {
            type: 'homePoint' as const,
            latitude: location.latitude,
            longitude: location.longitude,
            locality: geo.locality || 'Current Location',
            postalCode: geo.postalCode || '',
            country: geo.country || 'Unknown',
          };
          
          const updatedRoutes = [...(config?.routes || []), newHomePoint];
          onChange({ ...config, routes: updatedRoutes });
          
          console.log('✅ Auto-detected home base:', newHomePoint);
        } catch (error) {
          console.log('ℹ️ Could not auto-detect location:', error);
          // Не показуємо помилку користувачу - це автоматична функція
        }
      }
    };

    // Запускаємо через невелику затримку щоб конфіг встиг завантажитись
    const timer = setTimeout(autoDetectLocation, 1000);
    return () => clearTimeout(timer);
  }, [config?.routes]);

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
    // Note: bearerToken is now managed automatically by extension, no manual editing
    onChange({ ...config, [field]: value });
  };

  const handleMapSelect = async (lat: number, lon: number) => {
    if (!mapModal) return;
    
    console.log('🗺️ Map selected:', { lat, lon, modalType: mapModal.type });
    
    const geo = await reverseGeocode(lat, lon);
    console.log('🌍 Geocoded result:', geo);

    if (mapModal.type === 'home') {
      // Update or create home base in routes array
      const homePoint = config.routes?.find(r => r.type === 'homePoint');
      console.log('🏠 Current home point:', homePoint);
      
      if (homePoint) {
        // Update existing home point
        const updatedRoutes = config.routes.map(r => 
          r.type === 'homePoint' ? {
            ...r,
            latitude: lat,
            longitude: lon,
            locality: geo.locality || r.locality,
            postalCode: geo.postalCode || r.postalCode,
            country: geo.country || r.country,
          } : r
        );
        console.log('✏️ Updating existing home point:', updatedRoutes);
        onChange({ ...config, routes: updatedRoutes });
      } else {
        // Create new home point if it doesn't exist
        const newHomePoint = {
          type: 'homePoint' as const,
          latitude: lat,
          longitude: lon,
          locality: geo.locality || 'Unknown',
          postalCode: geo.postalCode || '',
          country: geo.country || 'Unknown',
        };
        
        const updatedRoutes = [...(config.routes || []), newHomePoint];
        console.log('➕ Creating new home point:', updatedRoutes);
        onChange({ ...config, routes: updatedRoutes });
      }
    }

    setMapModal(null);
  };

  const handleUseCurrentLocation = async () => {
    if (!isGeolocationAvailable()) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    try {
      console.log('📍 Getting current location...');
      const location = await getCurrentLocation();
      console.log('📍 Current location:', location);
      
      // Використовуємо ту ж логіку що і в handleMapSelect
      await handleMapSelect(location.latitude, location.longitude);
      
      // Показуємо повідомлення про успіх
      alert(`✅ Home base set to your current location!\nAccuracy: ${location.accuracy ? Math.round(location.accuracy) + 'm' : 'unknown'}`);
      
    } catch (error) {
      console.error('❌ Error getting location:', error);
      alert(`❌ Could not get your location: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="config-panel">
      <h2>🚛 Larry Route Planner</h2>

      <section className="config-section">
        <h3 onClick={() => toggleSection('api')} className="collapsible-header">
          🔐 Authentication & API
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
        {/* Token Status Display - No Manual Input */}
        <div className="field">
          <label>🔐 Authentication Status</label>
          <div style={{ 
            padding: '12px', 
            borderRadius: '6px', 
            backgroundColor: config.bearerToken ? '#e8f5e8' : '#fff3cd',
            border: `1px solid ${config.bearerToken ? '#28a745' : '#ffc107'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              {config.bearerToken ? (
                <span style={{ color: '#155724', fontWeight: '500' }}>
                  ✅ Токен автоматично завантажено з Chrome Extension
                </span>
              ) : (
                <span style={{ color: '#856404', fontWeight: '500' }}>
                  ⏳ Очікування токену з Chrome Extension...
                </span>
              )}
              {config.bearerToken && (
                <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
                  Токен: {config.bearerToken.substring(0, 20)}...
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!config.bearerToken && isInExtensionContext() && (
                <button
                  type="button"
                  onClick={() => {
                    console.log('Larry: Manually requesting token from extension...');
                    requestTokenFromExtension();
                  }}
                  style={{
                    padding: '6px 12px',
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
              {config.bearerToken && isInExtensionContext() && (
                <button
                  type="button"
                  onClick={() => {
                    console.log('Larry: Refreshing token from extension...');
                    requestTokenFromExtension();
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    border: '1px solid #17a2b8',
                    borderRadius: '4px',
                    background: '#17a2b8',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                  title="Оновити токен з platform.trans.eu"
                >
                  🔄 Refresh Token
                </button>
              )}
              {isInExtensionContext() && (
                <button
                  type="button"
                  onClick={() => {
                    console.log('Larry: Requesting filters from extension...');
                    requestFiltersFromExtension();
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    border: '1px solid #28a745',
                    borderRadius: '4px',
                    background: '#28a745',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                  title="Оновити фільтри з platform.trans.eu"
                >
                  📥 Оновити фільтри
                </button>
              )}
            </div>
          </div>
          {!isInExtensionContext() && (
            <div className="help-text" style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <strong>💡 Як використовувати:</strong><br/>
              1. Встановіть Chrome Extension для Larry Route Planner<br/>
              2. Відкрийте <a href="https://platform.trans.eu" target="_blank" rel="noopener">platform.trans.eu</a><br/>
              3. Увійдіть в свій акаунт<br/>
              4. Натисніть на іконку Larry Extension (🚛) на сторінці<br/>
              5. Токен буде автоматично завантажено
            </div>
          )}
        </div>
        </div>
        )}
      </section>

      {/* Інформація про Extension контекст */}
      {isInExtensionContext() && (
        <section className="config-section">
          <div className="extension-info">
            <h3>📍 Loading & Unloading Points</h3>
            <div className="help-text">
              <strong>Extension Mode:</strong> Loading and unloading points are automatically extracted from the Trans.eu platform.
              <br/>
              <strong>Current Points:</strong>
              {config?.routes?.filter(p => p.type === 'loadingPoint').length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <strong>Loading:</strong> {config.routes.filter(p => p.type === 'loadingPoint').map(p => {
                    // Якщо locality порожній, але є country - показуємо країну
                    const displayName = p.locality || (p.country ? getCountryDisplayName(p.country) : 'Unknown');
                    const postalInfo = p.postalCode || (p.locality ? 'No postal' : 'Country-wide');
                    return `${displayName} (${postalInfo}) - ${p.range || 50}km`;
                  }).join(', ')}
                </div>
              )}
              {config?.routes?.filter(p => p.type === 'unloadingPoint').length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <strong>Unloading:</strong> {config.routes.filter(p => p.type === 'unloadingPoint').map(p => {
                    // Якщо locality порожній, але є country - показуємо країну
                    const displayName = p.locality || (p.country ? getCountryDisplayName(p.country) : 'Unknown');
                    const postalInfo = p.postalCode || (p.locality ? 'No postal' : 'Country-wide');
                    return `${displayName} (${postalInfo}) - ${p.range || 50}km`;
                  }).join(', ')}
                </div>
              )}
              {config?.routes?.filter(p => p.type === 'homePoint').length > 0 && (
                <div style={{ marginTop: '4px', padding: '8px', background: '#e8f5e8', borderRadius: '4px', border: '1px solid #4caf50' }}>
                  <strong>🏠 Home Base:</strong> {config.routes.filter(p => p.type === 'homePoint').map(p => {
                    const displayName = p.locality || (p.country ? getCountryDisplayName(p.country) : 'Unknown');
                    const postalInfo = p.postalCode || (p.locality ? 'No postal' : 'Country-wide');
                    const coords = `${p.latitude?.toFixed(4)}, ${p.longitude?.toFixed(4)}`;
                    return (
                      <div key={`${p.latitude}-${p.longitude}`}>
                        📍 {displayName} ({postalInfo})<br/>
                        <small style={{ color: '#666' }}>Coordinates: {coords}</small>
                      </div>
                    );
                  })}
                </div>
              )}
              {(!config?.routes?.length) && (
                <div style={{ marginTop: '8px', color: '#ff6b6b' }}>
                  ⚠️ No points detected. Make sure you have selected locations on the Trans.eu platform.
                </div>
              )}
              
              {/* Vehicle Types Configuration */}
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="field">
                  <label>🚛 Типи вантажівок</label>
                  <div className="vehicle-types-section">
                    {extensionVehicleTypes.length > 0 ? (
                      <div className="selected-types">
                        <div className="types-header">
                          <strong>✅ Вибрано на platform.trans.eu ({extensionVehicleTypes.length}):</strong>
                          <button
                            type="button"
                            onClick={() => setVehicleTypesModal(true)}
                            className="btn-link"
                          >
                            Переглянути деталі
                          </button>
                        </div>
                        <div className="types-list">
                          {extensionVehicleTypes.map((type, index) => (
                            <span key={index} className="type-badge active">
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="no-types">
                        <span className="status-warning">⚠️ Типи вантажівок не вибрано на сайті</span>
                        <div className="default-types">
                          <strong>Використовуються дефолтні:</strong>
                          <div className="types-list">
                            {convertApiCodesToVehicleTypes(["2_double_trailer", "3_lorry", "5_solo"]).map((type, index) => (
                              <span key={index} className="type-badge default">
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="help-text">
                    Типи вантажівок автоматично синхронізуються з вашими налаштуваннями на platform.trans.eu. 
                    Щоб змінити типи, оновіть фільтри на основній сторінці сайту.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Loading and Unloading Points sections removed - managed by Extension */}

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
              checked={false}
              disabled={true}
            />
            Use first loading point as home base (Extension mode - managed automatically)
          </label>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Home City</label>
            <input
              type="text"
              value={config.routes?.find(r => r.type === 'homePoint')?.locality || ''}
              disabled={isInExtensionContext()}
              onChange={(e) => {
                if (!isInExtensionContext()) {
                  const homePoint = config.routes?.find(r => r.type === 'homePoint');
                  if (homePoint) {
                    const updatedRoutes = config.routes.map(r => 
                      r.type === 'homePoint' ? { ...r, locality: e.target.value } : r
                    );
                    onChange({ ...config, routes: updatedRoutes });
                  }
                }
              }}
            />
          </div>
          <div className="field">
            <label>Home Lat</label>
            <input
              type="number"
              step="0.000001"
              value={config.routes?.find(r => r.type === 'homePoint')?.latitude || 0}
              disabled={isInExtensionContext()}
              onChange={(e) => {
                if (!isInExtensionContext()) {
                  const homePoint = config.routes?.find(r => r.type === 'homePoint');
                  if (homePoint) {
                    const updatedRoutes = config.routes.map(r => 
                      r.type === 'homePoint' ? { ...r, latitude: parseFloat(e.target.value) || 0 } : r
                    );
                    onChange({ ...config, routes: updatedRoutes });
                  }
                }
              }}
            />
          </div>
          <div className="field">
            <label>Home Lon</label>
            <input
              type="number"
              step="0.000001"
              value={config.routes?.find(r => r.type === 'homePoint')?.longitude || 0}
              disabled={isInExtensionContext()}
              onChange={(e) => {
                if (!isInExtensionContext()) {
                  const homePoint = config.routes?.find(r => r.type === 'homePoint');
                  if (homePoint) {
                    const updatedRoutes = config.routes.map(r => 
                      r.type === 'homePoint' ? { ...r, longitude: parseFloat(e.target.value) || 0 } : r
                    );
                    onChange({ ...config, routes: updatedRoutes });
                  }
                }
              }}
            />
          </div>
        </div>
        <div className="field">
          <button
            className="pick-map-btn"
            onClick={() => {
              const homePoint = config.routes?.find(r => r.type === 'homePoint');
              setMapModal({
                type: 'home',
                index: null,
                initialLat: homePoint?.latitude || 0,
                initialLon: homePoint?.longitude || 0,
              });
            }}
            title="Pick home base on map"
            style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
          >
            🗺️ Pick Home Base on Map
          </button>
          
          <button
            className="pick-map-btn"
            onClick={handleUseCurrentLocation}
            title="Use your current location as home base"
            style={{ width: '100%', padding: '8px', background: '#2c5aa0' }}
          >
            📍 Use My Current Location
          </button>
        </div>
        </div>
        )}
      </section>

      {/* <section className="config-section">
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
      </section> */}

      <section className="config-section">
        <h3 onClick={() => toggleSection('optimization')} className="collapsible-header">
          🔄 Route Optimization
          <span className="collapse-icon">{collapsed.optimization ? '▶' : '▼'}</span>
        </h3>
        {!collapsed.optimization && (
          <div className="section-content">
        
        {/* Route Strategy Selection */}
        {/* <div className="field">
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
        </div> */}
        
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
        {/* {(config.routeStrategy === RouteStrategy.NEW_STRATEGY || 
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
        )} */}
        
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
          {/* Поле maxResults приховано - виводимо всі маршрути без обмежень */}
        </div>
        <div className="field-row">
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
          📅 Departure & Return Dates
          <span className="collapse-icon">{collapsed.dates ? '▶' : '▼'}</span>
        </h3>
        {!collapsed.dates && (
          <div className="section-content">
        <div className="field-row">
          <div className="field">
            <label htmlFor="departureDate">Departure Date</label>
            <input
              id="departureDate"
              type="date"
              value={config.departureDate}
              onChange={(e) => updateField('departureDate', e.target.value)}
              title="Дата відправлення"
            />
          </div>
          <div className="field">
            <label htmlFor="returnDate">Return Date</label>
            <input
              id="returnDate"
              type="date"
              value={config.returnDate}
              onChange={(e) => updateField('returnDate', e.target.value)}
              title="Дата повернення"
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

      <button 
        className="fetch-btn" 
        onClick={onFetch} 
        disabled={loading || !config?.routes?.length}
      >
        {loading ? '⏳ Loading...' : 
         !config.routes?.length ? '⚠️ Додайте точки завантаження та розвантаження' :
         '🔍 Fetch & Optimize Routes'}
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

      <VehicleTypesModal
        isOpen={vehicleTypesModal}
        onClose={() => setVehicleTypesModal(false)}
        extensionTypes={extensionVehicleTypes}
      />
    </div>
  );
}