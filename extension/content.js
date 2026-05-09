// Larry Route Planner - Content Script
// Injects an iframe overlay with the Larry Route Planner app

(function () {
  const PANEL_ID = 'larry-route-planner-panel';
  const TOGGLE_ID = 'larry-route-planner-toggle';

  // URL of your running Larry Route Planner app
  // Change this if your dev server runs on a different port
  const APP_URL = 'http://localhost:7739';

  let panel = null;
  let toggleBtn = null;
  let isOpen = false;

  function createToggleButton() {
    if (document.getElementById(TOGGLE_ID)) return;

    toggleBtn = document.createElement('div');
    toggleBtn.id = TOGGLE_ID;
    toggleBtn.innerHTML = '🚛';
    toggleBtn.title = 'Larry Route Planner';
    toggleBtn.addEventListener('click', toggle);
    document.body.appendChild(toggleBtn);
  }

  async function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    panel = document.createElement('div');
    panel.id = PANEL_ID;
    
    // Get token and filters from platform.trans.eu
    const token = getTokenFromStorage();
    const filters = await parseFiltersFromPage();
    
    // Build URL with token and filters
    let appUrl = APP_URL;
    const params = new URLSearchParams();
    
    if (token) {
      params.set('token', token);
    }
    if (filters) {
      params.set('filters', JSON.stringify(filters));
    }
    
    if (params.toString()) {
      appUrl += '?' + params.toString();
    }
    
    panel.innerHTML = `
      <div class="larry-panel-header">
        <span class="larry-panel-title">🚛 Larry Route Planner</span>
        <div class="larry-panel-controls">
          <button class="larry-panel-resize" title="Toggle size">⤢</button>
          <button class="larry-panel-close" title="Close">✕</button>
        </div>
      </div>
      <iframe src="${appUrl}" class="larry-panel-iframe"></iframe>
    `;

    panel.querySelector('.larry-panel-close').addEventListener('click', hide);
    panel.querySelector('.larry-panel-resize').addEventListener('click', toggleSize);

    // Make panel draggable by header
    makeDraggable(panel, panel.querySelector('.larry-panel-header'));

    document.body.appendChild(panel);
    
    // Set up communication with iframe
    setupIframeCommunication();
  }

  function getTokenFromStorage() {
    try {
      // Get token from platform.trans.eu localStorage
      const token = localStorage.getItem('transFrameToken');
      console.log('Larry Extension: Found token in localStorage:', token ? 'Yes' : 'No');
      return token || '';
    } catch (error) {
      console.warn('Larry Extension: Failed to read token from localStorage:', error);
      return '';
    }
  }

  async function parseFiltersFromPage() {
    try {
      const filters = {
        loadingPoints: [],
        unloadingPoints: [],
        minWeight: null,
        maxWeight: null,
        minCapacity: null,
        maxCapacity: null,
        vehicleTypes: [],
        freightTypes: [],
        placesMatchingType: 'cross' // default
      };

      console.log('Larry Extension: Starting to parse filters from page...');

      // Parse loading places - try multiple selectors
      let loadingInputs = document.querySelectorAll('[data-ctx*="place-loading_place"] input[type="text"]');
      if (loadingInputs.length === 0) {
        // Try alternative selectors
        loadingInputs = document.querySelectorAll('input[name*="loading_place"]');
      }
      if (loadingInputs.length === 0) {
        // Try more generic approach
        loadingInputs = document.querySelectorAll('input[placeholder*="loading"], input[placeholder*="завантаження"]');
      }
      
      console.log('Found loading inputs:', loadingInputs.length);
      
      // Process loading points with async geocoding
      for (let index = 0; index < loadingInputs.length; index++) {
        const input = loadingInputs[index];
        if (input.value && input.value.trim()) {
          console.log(`Processing loading input ${index}:`, input.value);
          const locationData = await parseLocationString(input.value);
          if (locationData) {
            const rangeInput = input.closest('[data-ctx*="place-loading_place"]')?.querySelector('[name="range"]') ||
                              input.closest('.form-group, .field-group')?.querySelector('[name="range"], input[type="number"]');
            filters.loadingPoints.push({
              id: `lp${index + 1}`,
              locality: locationData.locality,
              postalCode: locationData.postalCode,
              country: locationData.country,
              latitude: locationData.latitude || 0,
              longitude: locationData.longitude || 0,
              range: rangeInput ? parseInt(rangeInput.value) || 50 : 50
            });
          }
        }
      }

      // Parse unloading places - try multiple selectors
      let unloadingInputs = document.querySelectorAll('[data-ctx*="place-unloading_place"] input[type="text"]');
      if (unloadingInputs.length === 0) {
        unloadingInputs = document.querySelectorAll('input[name*="unloading_place"]');
      }
      if (unloadingInputs.length === 0) {
        unloadingInputs = document.querySelectorAll('input[placeholder*="unloading"], input[placeholder*="розвантаження"]');
      }
      
      console.log('Found unloading inputs:', unloadingInputs.length);
      
      // Process unloading points with async geocoding
      for (let index = 0; index < unloadingInputs.length; index++) {
        const input = unloadingInputs[index];
        if (input.value && input.value.trim()) {
          console.log(`Processing unloading input ${index}:`, input.value);
          const locationData = await parseLocationString(input.value);
          if (locationData) {
            filters.unloadingPoints.push({
              id: `up${index + 1}`,
              locality: locationData.locality,
              postalCode: locationData.postalCode,
              country: locationData.country,
              latitude: locationData.latitude || 0,
              longitude: locationData.longitude || 0,
              range: 50 // default range for unloading
            });
          }
        }
      }

      // Parse weight - try multiple selectors with improved detection
      console.log('Larry Extension: Starting weight parsing...');
      
      // Try exact selectors first
      let weightFromInput = document.querySelector('[data-ctx="load_weight.valueFrom"] input');
      let weightToInput = document.querySelector('[data-ctx="load_weight.valueTo"] input');
      
      // Try specific IDs from your HTML
      if (!weightFromInput) {
        weightFromInput = document.querySelector('input[id=":r4:"]');
      }
      if (!weightToInput) {
        weightToInput = document.querySelector('input[id=":r5:"]');
      }
      
      // Try by parentname attribute
      if (!weightFromInput) {
        weightFromInput = document.querySelector('input[name="valueFrom"][parentname="load_weight"]');
      }
      if (!weightToInput) {
        weightToInput = document.querySelector('input[name="valueTo"][parentname="load_weight"]');
      }
      
      // Try by placeholder text
      if (!weightFromInput) {
        weightFromInput = document.querySelector('input[placeholder="З"]');
      }
      if (!weightToInput) {
        weightToInput = document.querySelector('input[placeholder="До"]');
      }
      
      // Also try to find weight inputs by their context in the weight section
      if (!weightFromInput || !weightToInput) {
        const weightSection = document.querySelector('[data-ctx="load-weight"]') || 
                             document.querySelector('[data-ctx="rangeWeight"]') ||
                             document.querySelector('[data-ctx="swithToWeight"]')?.closest('div');
        if (weightSection) {
          console.log('Larry Extension: Found weight section:', weightSection);
          const weightInputs = weightSection.querySelectorAll('input[type="text"]');
          console.log('Larry Extension: Weight inputs in section:', weightInputs.length, weightInputs);
          if (weightInputs.length >= 2) {
            weightFromInput = weightFromInput || weightInputs[0];
            weightToInput = weightToInput || weightInputs[1];
          }
        }
      }
      
      console.log('Larry Extension: Weight inputs found:');
      console.log('- weightFromInput:', weightFromInput, 'value:', weightFromInput?.value, 'id:', weightFromInput?.id);
      console.log('- weightToInput:', weightToInput, 'value:', weightToInput?.value, 'id:', weightToInput?.id);
      
      // Parse weight values with detailed logging
      if (weightFromInput) {
        const rawValue = weightFromInput.value;
        console.log('Larry Extension: Processing minWeight - raw value:', `"${rawValue}"`);
        if (rawValue && rawValue.trim()) {
          const minWeightValue = parseFloat(rawValue.replace(',', '.'));
          console.log('Larry Extension: Parsed minWeight value:', minWeightValue);
          if (minWeightValue && minWeightValue > 0) {
            filters.minWeight = minWeightValue;
            console.log('Larry Extension: ✅ Set minWeight to:', filters.minWeight);
          } else {
            console.log('Larry Extension: ❌ minWeight value invalid or zero');
          }
        } else {
          console.log('Larry Extension: ❌ minWeight field is empty, setting to 0');
          filters.minWeight = 0;
        }
      } else {
        console.log('Larry Extension: ❌ minWeight input not found, setting to 0');
        filters.minWeight = 0;
      }
      
      if (weightToInput) {
        const rawValue = weightToInput.value;
        console.log('Larry Extension: Processing maxWeight - raw value:', `"${rawValue}"`);
        if (rawValue && rawValue.trim()) {
          const maxWeightValue = parseFloat(rawValue.replace(',', '.'));
          console.log('Larry Extension: Parsed maxWeight value:', maxWeightValue);
          if (maxWeightValue && maxWeightValue > 0) {
            filters.maxWeight = maxWeightValue;
            console.log('Larry Extension: ✅ Set maxWeight to:', filters.maxWeight);
          } else {
            console.log('Larry Extension: ❌ maxWeight value invalid or zero');
          }
        } else {
          console.log('Larry Extension: ❌ maxWeight field is empty');
        }
      } else {
        console.log('Larry Extension: ❌ maxWeight input not found');
      }
      
      // Debug: log all weight-related inputs found on page
      console.log('Larry Extension: All weight-related inputs on page:');
      const allWeightInputs = document.querySelectorAll('input[name*="weight"], input[data-ctx*="weight"], input[parentname*="weight"], input[id*=":r4:"], input[id*=":r5:"]');
      allWeightInputs.forEach((input, index) => {
        console.log(`  ${index + 1}. ${input.tagName} id="${input.id}" name="${input.name}" value="${input.value}" parentname="${input.getAttribute('parentname')}"`);
      });

      // Parse cargo capacity (vehicle capacity)
      console.log('Larry Extension: Starting capacity parsing...');
      
      let capacityFromInput = document.querySelector('[data-ctx="cargo_capacity.valueFrom"] input');
      let capacityToInput = document.querySelector('[data-ctx="cargo_capacity.valueTo"] input');
      
      // Try transport_per_order selectors (from your HTML)
      if (!capacityFromInput) {
        capacityFromInput = document.querySelector('[data-ctx="transport_per_order.valueFrom"] input') ||
                           document.querySelector('input[id=":r6:"]') ||
                           document.querySelector('input[name="valueFrom"][parentname="transport_per_order"]');
      }
      if (!capacityToInput) {
        capacityToInput = document.querySelector('[data-ctx="transport_per_order.valueTo"] input') ||
                         document.querySelector('input[id=":r7:"]') ||
                         document.querySelector('input[name="valueTo"][parentname="transport_per_order"]');
      }
      
      console.log('Larry Extension: Capacity inputs found:');
      console.log('- capacityFromInput:', capacityFromInput, 'value:', capacityFromInput?.value, 'id:', capacityFromInput?.id);
      console.log('- capacityToInput:', capacityToInput, 'value:', capacityToInput?.value, 'id:', capacityToInput?.id);
      
      if (capacityFromInput) {
        const rawValue = capacityFromInput.value;
        console.log('Larry Extension: Processing minCapacity - raw value:', `"${rawValue}"`);
        if (rawValue && rawValue.trim()) {
          const minCapacityValue = parseFloat(rawValue.replace(',', '.'));
          console.log('Larry Extension: Parsed minCapacity value:', minCapacityValue);
          if (minCapacityValue && minCapacityValue > 0) {
            filters.minCapacity = minCapacityValue;
            console.log('Larry Extension: ✅ Set minCapacity to:', filters.minCapacity);
          } else {
            console.log('Larry Extension: ❌ minCapacity value invalid or zero');
          }
        } else {
          console.log('Larry Extension: ❌ minCapacity field is empty, setting to 0');
          filters.minCapacity = 0;
        }
      } else {
        console.log('Larry Extension: ❌ minCapacity input not found, setting to 0');
        filters.minCapacity = 0;
      }
      
      if (capacityToInput) {
        const rawValue = capacityToInput.value;
        console.log('Larry Extension: Processing maxCapacity - raw value:', `"${rawValue}"`);
        if (rawValue && rawValue.trim()) {
          const maxCapacityValue = parseFloat(rawValue.replace(',', '.'));
          console.log('Larry Extension: Parsed maxCapacity value:', maxCapacityValue);
          if (maxCapacityValue && maxCapacityValue > 0) {
            filters.maxCapacity = maxCapacityValue;
            console.log('Larry Extension: ✅ Set maxCapacity to:', filters.maxCapacity);
          } else {
            console.log('Larry Extension: ❌ maxCapacity value invalid or zero');
          }
        } else {
          console.log('Larry Extension: ❌ maxCapacity field is empty');
        }
      } else {
        console.log('Larry Extension: ❌ maxCapacity input not found');
      }

      // Parse freight types
      const freightCheckboxes = document.querySelectorAll('[name="freight_types"]:checked, input[type="checkbox"][name*="freight"]:checked');
      freightCheckboxes.forEach(checkbox => {
        const label = checkbox.closest('label')?.textContent?.trim() || 
                     checkbox.nextElementSibling?.textContent?.trim() ||
                     checkbox.previousElementSibling?.textContent?.trim();
        if (label) {
          filters.freightTypes.push(label);
        }
      });
      console.log('Found freight types:', filters.freightTypes);

      // Parse vehicle types
      const vehicleCheckboxes = document.querySelectorAll('[name="vehicle_size"]:checked, input[type="checkbox"][name*="vehicle"]:checked');
      vehicleCheckboxes.forEach(checkbox => {
        const label = checkbox.closest('label')?.textContent?.trim() ||
                     checkbox.nextElementSibling?.textContent?.trim() ||
                     checkbox.previousElementSibling?.textContent?.trim();
        if (label) {
          filters.vehicleTypes.push(label);
        }
      });
      console.log('Found vehicle types:', filters.vehicleTypes);

      // Parse places matching type
      const crossButton = document.querySelector('[data-ctx="places-matching-type-cross"]');
      const pairsButton = document.querySelector('[data-ctx="places-matching-type-pairs"]');
      if (crossButton && !crossButton.disabled) {
        filters.placesMatchingType = 'cross';
      } else if (pairsButton && !pairsButton.disabled) {
        filters.placesMatchingType = 'pairs';
      }

      console.log('Larry Extension: Final parsed filters:', filters);
      
      // Log specific weight values for debugging
      console.log('Larry Extension: Weight debug - minWeight:', filters.minWeight, 'maxWeight:', filters.maxWeight);
      console.log('Larry Extension: Capacity debug - minCapacity:', filters.minCapacity, 'maxCapacity:', filters.maxCapacity);
      
      return filters;
    } catch (error) {
      console.warn('Larry Extension: Failed to parse filters from page:', error);
      return null;
    }
  }

  // Get default postal codes for major cities
  function getDefaultPostalCode(cityName, countryCode) {
    const defaultPostalCodes = {
      // Germany
      'Berlin': '10115',
      'München': '80331',
      'Hamburg': '20095',
      'Köln': '50667',
      'Frankfurt': '60311',
      'Stuttgart': '70173',
      'Düsseldorf': '40213',
      'Dortmund': '44135',
      'Essen': '45127',
      'Leipzig': '04109',
      'Bremen': '28195',
      'Dresden': '01067',
      'Hannover': '30159',
      'Nürnberg': '90402',
      
      // Poland
      'Warszawa': '00-001',
      'Kraków': '30-001',
      'Łódź': '90-001',
      'Wrocław': '50-001',
      'Poznań': '60-001',
      'Gdańsk': '80-001',
      'Szczecin': '70-001',
      'Bydgoszcz': '85-001',
      'Lublin': '20-001',
      'Katowice': '40-001',
      
      // France
      'Paris': '75001',
      'Marseille': '13001',
      'Lyon': '69001',
      'Toulouse': '31000',
      'Nice': '06000',
      'Nantes': '44000',
      'Strasbourg': '67000',
      'Montpellier': '34000',
      'Bordeaux': '33000',
      'Lille': '59000',
      
      // Czech Republic
      'Praha': '110 00',
      'Brno': '602 00',
      'Ostrava': '702 00',
      'Plzeň': '301 00',
      
      // Austria
      'Wien': '1010',
      'Graz': '8010',
      'Linz': '4020',
      'Salzburg': '5020',
      'Innsbruck': '6020',
      
      // Netherlands
      'Amsterdam': '1012',
      'Rotterdam': '3011',
      'Den Haag': '2511',
      'Utrecht': '3511',
      'Eindhoven': '5611',
      
      // Belgium
      'Brussels': '1000',
      'Antwerp': '2000',
      'Ghent': '9000',
      'Charleroi': '6000',
      'Liège': '4000'
    };
    
    return defaultPostalCodes[cityName] || '';
  }

  // Get more accurate coordinates for specific cities
  function getCityCoordinates(cityName, countryCode) {
    const cityCoordinates = {
      // Germany
      'Berlin': { lat: 52.5200, lon: 13.4050 },
      'München': { lat: 48.1351, lon: 11.5820 },
      'Hamburg': { lat: 53.5511, lon: 9.9937 },
      'Köln': { lat: 50.9375, lon: 6.9603 },
      'Frankfurt': { lat: 50.1109, lon: 8.6821 },
      'Stuttgart': { lat: 48.7758, lon: 9.1829 },
      'Düsseldorf': { lat: 51.2277, lon: 6.7735 },
      'Dortmund': { lat: 51.5136, lon: 7.4653 },
      'Essen': { lat: 51.4556, lon: 7.0116 },
      'Leipzig': { lat: 51.3397, lon: 12.3731 },
      'Bremen': { lat: 53.0793, lon: 8.8017 },
      'Dresden': { lat: 51.0504, lon: 13.7373 },
      'Hannover': { lat: 52.3759, lon: 9.7320 },
      'Nürnberg': { lat: 49.4521, lon: 11.0767 },
      
      // Poland
      'Warszawa': { lat: 52.2297, lon: 21.0122 },
      'Kraków': { lat: 50.0647, lon: 19.9450 },
      'Łódź': { lat: 51.7592, lon: 19.4560 },
      'Wrocław': { lat: 51.1079, lon: 17.0385 },
      'Poznań': { lat: 52.4064, lon: 16.9252 },
      'Gdańsk': { lat: 54.3520, lon: 18.6466 },
      'Szczecin': { lat: 53.4285, lon: 14.5528 },
      'Bydgoszcz': { lat: 53.1235, lon: 18.0084 },
      'Lublin': { lat: 51.2465, lon: 22.5684 },
      'Katowice': { lat: 50.2649, lon: 19.0238 },
      
      // France
      'Paris': { lat: 48.8566, lon: 2.3522 },
      'Marseille': { lat: 43.2965, lon: 5.3698 },
      'Lyon': { lat: 45.7640, lon: 4.8357 },
      'Toulouse': { lat: 43.6047, lon: 1.4442 },
      'Nice': { lat: 43.7102, lon: 7.2620 },
      'Nantes': { lat: 47.2184, lon: -1.5536 },
      'Strasbourg': { lat: 48.5734, lon: 7.7521 },
      'Montpellier': { lat: 43.6110, lon: 3.8767 },
      'Bordeaux': { lat: 44.8378, lon: -0.5792 },
      'Lille': { lat: 50.6292, lon: 3.0573 },
      
      // Czech Republic
      'Praha': { lat: 50.0755, lon: 14.4378 },
      'Brno': { lat: 49.1951, lon: 16.6068 },
      'Ostrava': { lat: 49.8209, lon: 18.2625 },
      'Plzeň': { lat: 49.7384, lon: 13.3736 },
      
      // Austria
      'Wien': { lat: 48.2082, lon: 16.3738 },
      'Graz': { lat: 47.0707, lon: 15.4395 },
      'Linz': { lat: 48.3069, lon: 14.2858 },
      'Salzburg': { lat: 47.8095, lon: 13.0550 },
      'Innsbruck': { lat: 47.2692, lon: 11.4041 },
      
      // Netherlands
      'Amsterdam': { lat: 52.3676, lon: 4.9041 },
      'Rotterdam': { lat: 51.9244, lon: 4.4777 },
      'Den Haag': { lat: 52.0705, lon: 4.3007 },
      'Utrecht': { lat: 52.0907, lon: 5.1214 },
      'Eindhoven': { lat: 51.4416, lon: 5.4697 },
      
      // Belgium
      'Brussels': { lat: 50.8503, lon: 4.3517 },
      'Antwerp': { lat: 51.2194, lon: 4.4025 },
      'Ghent': { lat: 51.0543, lon: 3.7174 },
      'Charleroi': { lat: 50.4108, lon: 4.4446 },
      'Liège': { lat: 50.6326, lon: 5.5797 }
    };
    
    const cityKey = cityName;
    if (cityCoordinates[cityKey]) {
      return cityCoordinates[cityKey];
    }
    
    // Fallback to country coordinates
    return getCountryCoordinates(countryCode);
  }

  async function parseLocationString(locationStr) {
    try {
      console.log('Parsing location string:', locationStr);
      
      // Handle different formats from platform.trans.eu:
      // "PL, 30-001, Kraków" 
      // "DE, 10115, Berlin"
      // "DE, Німеччина" (country only)
      // "FR, Франція" (country only)
      // "Kraków, PL" (reverse format)
      // "Berlin" (city only)
      
      const parts = locationStr.split(',').map(p => p.trim());
      
      // Try to detect country code (2-letter codes)
      const countryCodeRegex = /^[A-Z]{2}$/;
      let countryCode = '';
      let locality = '';
      let postalCode = '';
      
      if (parts.length >= 3) {
        // Format: "PL, 30-001, Kraków" or "DE, 10115, Berlin"
        if (countryCodeRegex.test(parts[0])) {
          countryCode = parts[0];
          postalCode = parts[1];
          locality = parts[2];
        } else if (countryCodeRegex.test(parts[2])) {
          // Reverse format: "Kraków, 30-001, PL"
          locality = parts[0];
          postalCode = parts[1];
          countryCode = parts[2];
        }
      } else if (parts.length === 2) {
        if (countryCodeRegex.test(parts[0])) {
          // Format: "DE, Німеччина" or "DE, Berlin"
          countryCode = parts[0];
          locality = parts[1];
        } else if (countryCodeRegex.test(parts[1])) {
          // Format: "Berlin, DE"
          locality = parts[0];
          countryCode = parts[1];
        }
      } else if (parts.length === 1) {
        // Single city name - try to guess country from common cities
        locality = parts[0];
        countryCode = guessCountryFromCity(locality);
      }
      
      if (!countryCode) {
        console.warn('Could not determine country code for:', locationStr);
        return null;
      }
      
      // Check if locality is actually a country name (not a city)
      if (isCountryNameStr(locality)) {
        console.log('Locality is a country name, not a city:', locality);
        // When only country is selected, don't include locality or postal code
        const coords = getCountryCoordinates(countryCode);
        return {
          country: parseCountryCode(countryCode),
          postalCode: '', // intentionally empty - API should work without it for country-only
          locality: '', // don't send country name as city
          latitude: coords.lat,
          longitude: coords.lon
        };
      }
      
      // If we don't have a postal code, try to geocode the city
      if (!postalCode && locality) {
        console.log('No postal code found, attempting to geocode:', locality, countryCode);
        const geocodedData = await geocodeCity(locality, countryCode);
        if (geocodedData) {
          return {
            country: geocodedData.country,
            postalCode: geocodedData.postalCode,
            locality: geocodedData.locality,
            latitude: geocodedData.latitude,
            longitude: geocodedData.longitude
          };
        }
      }
      
      // Fallback to static coordinates if geocoding fails or postal code exists
      const coords = getCityCoordinates(locality, countryCode);
      
      // If still no postal code, try to get a default one
      if (!postalCode) {
        postalCode = getDefaultPostalCode(locality, countryCode);
      }
      
      const result = {
        country: parseCountryCode(countryCode),
        postalCode: postalCode,
        locality: locality,
        latitude: coords.lat,
        longitude: coords.lon
      };
      
      console.log('Parsed location result:', result);
      return result;
    } catch (error) {
      console.warn('Failed to parse location string:', locationStr, error);
      return null;
    }
  }

  // Check if a string is a country name (not a city)
  function isCountryNameStr(name) {
    const countryNames = [
      // Ukrainian
      'Німеччина', 'Польща', 'Франція', 'Чехія', 'Австрія', 'Словаччина',
      'Угорщина', 'Італія', 'Іспанія', 'Нідерланди', 'Бельгія', 'Литва',
      'Латвія', 'Естонія', 'Румунія', 'Болгарія', 'Хорватія', 'Словенія',
      'Сербія', 'Боснія', 'Македонія', 'Албанія', 'Чорногорія', 'Швеція',
      'Норвегія', 'Данія', 'Фінляндія', 'Швейцарія', 'Люксембург',
      'Великобританія', 'Ірландія', 'Португалія', 'Греція', 'Туреччина',
      // English
      'Germany', 'Poland', 'France', 'Czech Republic', 'Austria', 'Slovakia',
      'Hungary', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Lithuania',
      'Latvia', 'Estonia', 'Romania', 'Bulgaria', 'Croatia', 'Slovenia',
      'Serbia', 'Bosnia', 'Macedonia', 'Albania', 'Montenegro', 'Sweden',
      'Norway', 'Denmark', 'Finland', 'Switzerland', 'Luxembourg',
      'United Kingdom', 'Ireland', 'Portugal', 'Greece', 'Turkey',
      // German
      'Deutschland', 'Polen', 'Frankreich', 'Tschechien', 'Österreich',
      'Slowakei', 'Ungarn', 'Italien', 'Spanien', 'Niederlande', 'Belgien',
      'Litauen', 'Lettland', 'Estland', 'Rumänien', 'Bulgarien', 'Kroatien',
      'Slowenien', 'Serbien', 'Bosnien', 'Mazedonien', 'Albanien',
      'Montenegro', 'Schweden', 'Norwegen', 'Dänemark', 'Finnland',
      'Schweiz', 'Luxemburg', 'Großbritannien', 'Irland', 'Portugal',
      'Griechenland', 'Türkei',
      // Polish
      'Niemcy', 'Polska', 'Francja', 'Czechy', 'Austria', 'Słowacja',
      'Węgry', 'Włochy', 'Hiszpania', 'Holandia', 'Belgia', 'Litwa',
      'Łotwa', 'Estonia', 'Rumunia', 'Bułgaria', 'Chorwacja', 'Słowenia',
      'Serbia', 'Bośnia', 'Macedonia', 'Albania', 'Czarnogóra'
    ];
    return countryNames.includes(name);
  }

  function guessCountryFromCity(cityName) {
    const cityCountryMap = {
      'Berlin': 'DE',
      'München': 'DE', 
      'Hamburg': 'DE',
      'Köln': 'DE',
      'Frankfurt': 'DE',
      'Stuttgart': 'DE',
      'Düsseldorf': 'DE',
      'Dortmund': 'DE',
      'Essen': 'DE',
      'Leipzig': 'DE',
      'Bremen': 'DE',
      'Dresden': 'DE',
      'Hannover': 'DE',
      'Nürnberg': 'DE',
      'Duisburg': 'DE',
      'Bochum': 'DE',
      'Wuppertal': 'DE',
      'Bielefeld': 'DE',
      'Bonn': 'DE',
      'Münster': 'DE',
      
      'Warszawa': 'PL',
      'Kraków': 'PL',
      'Łódź': 'PL',
      'Wrocław': 'PL',
      'Poznań': 'PL',
      'Gdańsk': 'PL',
      'Szczecin': 'PL',
      'Bydgoszcz': 'PL',
      'Lublin': 'PL',
      'Katowice': 'PL',
      'Białystok': 'PL',
      'Gdynia': 'PL',
      'Częstochowa': 'PL',
      'Radom': 'PL',
      'Sosnowiec': 'PL',
      'Toruń': 'PL',
      'Kielce': 'PL',
      'Gliwice': 'PL',
      'Zabrze': 'PL',
      'Bytom': 'PL',
      
      'Paris': 'FR',
      'Marseille': 'FR',
      'Lyon': 'FR',
      'Toulouse': 'FR',
      'Nice': 'FR',
      'Nantes': 'FR',
      'Strasbourg': 'FR',
      'Montpellier': 'FR',
      'Bordeaux': 'FR',
      'Lille': 'FR',
      
      'Praha': 'CZ',
      'Brno': 'CZ',
      'Ostrava': 'CZ',
      'Plzeň': 'CZ',
      
      'Wien': 'AT',
      'Graz': 'AT',
      'Linz': 'AT',
      'Salzburg': 'AT',
      'Innsbruck': 'AT',
      
      'Amsterdam': 'NL',
      'Rotterdam': 'NL',
      'Den Haag': 'NL',
      'Utrecht': 'NL',
      'Eindhoven': 'NL',
      'Tilburg': 'NL',
      'Groningen': 'NL',
      'Almere': 'NL',
      'Breda': 'NL',
      'Nijmegen': 'NL',
      
      'Brussels': 'BE',
      'Antwerp': 'BE',
      'Ghent': 'BE',
      'Charleroi': 'BE',
      'Liège': 'BE',
      'Bruges': 'BE',
      'Namur': 'BE',
      'Leuven': 'BE'
    };
    
    return cityCountryMap[cityName] || 'DE'; // Default to Germany
  }

  function getCountryCoordinates(countryCode) {
    const coordinates = {
      'PL': { lat: 52.0693, lon: 19.4803 }, // Poland center
      'DE': { lat: 51.1657, lon: 10.4515 }, // Germany center  
      'FR': { lat: 46.6034, lon: 1.8883 },  // France center
      'CZ': { lat: 49.8175, lon: 15.4730 }, // Czech Republic center
      'AT': { lat: 47.5162, lon: 14.5501 }, // Austria center
      'SK': { lat: 48.6690, lon: 19.6990 }, // Slovakia center
      'HU': { lat: 47.1625, lon: 19.5033 }, // Hungary center
      'IT': { lat: 41.8719, lon: 12.5674 }, // Italy center
      'ES': { lat: 40.4637, lon: -3.7492 }, // Spain center
      'NL': { lat: 52.1326, lon: 5.2913 },  // Netherlands center
      'BE': { lat: 50.5039, lon: 4.4699 },  // Belgium center
      'LT': { lat: 55.1694, lon: 23.8813 }, // Lithuania center
      'LV': { lat: 56.8796, lon: 24.6032 }, // Latvia center
      'EE': { lat: 58.5953, lon: 25.0136 }, // Estonia center
      'RO': { lat: 45.9432, lon: 24.9668 }, // Romania center
      'BG': { lat: 42.7339, lon: 25.4858 }, // Bulgaria center
      'HR': { lat: 45.1000, lon: 15.2000 }, // Croatia center
      'SI': { lat: 46.1512, lon: 14.9955 }, // Slovenia center
      'RS': { lat: 44.0165, lon: 21.0059 }, // Serbia center
      'BA': { lat: 43.9159, lon: 17.6791 }, // Bosnia center
      'MK': { lat: 41.6086, lon: 21.7453 }, // North Macedonia center
      'AL': { lat: 41.1533, lon: 20.1683 }, // Albania center
      'ME': { lat: 42.7087, lon: 19.3744 }, // Montenegro center
      'XK': { lat: 42.6026, lon: 20.9030 }  // Kosovo center
    };
    
    return coordinates[countryCode] || { lat: 50.0, lon: 10.0 };
  }

  // Geocode a city to get postal code using Nominatim API
  async function geocodeCity(cityName, countryCode) {
    try {
      console.log(`Geocoding city: ${cityName}, ${countryCode}`);
      
      // Build query for Nominatim
      const query = `${cityName}, ${countryCode}`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=${countryCode.toLowerCase()}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Larry Route Planner Extension/1.0'
        }
      });
      
      if (!response.ok) {
        console.warn('Nominatim API request failed:', response.status);
        return null;
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        console.log('Geocoding result:', result);
        
        return {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          postalCode: result.address?.postcode || '',
          locality: result.address?.city || result.address?.town || result.address?.village || cityName,
          country: parseCountryCode(countryCode)
        };
      }
      
      console.warn('No geocoding results found for:', query);
      return null;
    } catch (error) {
      console.warn('Geocoding failed:', error);
      return null;
    }
  }

  function parseCountryCode(countryStr) {
    const countryMap = {
      'PL': '47_poland',
      'DE': '21_germany', 
      'FR': '33_france',
      'CZ': '42_czech_republic',
      'AT': '43_austria',
      'SK': '421_slovakia',
      'HU': '36_hungary',
      'IT': '39_italy',
      'ES': '34_spain',
      'NL': '31_netherlands',
      'BE': '32_belgium'
    };
    return countryMap[countryStr] || countryStr;
  }

  function parseRange(input) {
    // Try to find range input near the location input
    const container = input.closest('[data-ctx*="place-"]');
    const rangeInput = container?.querySelector('[name="range"]');
    return rangeInput ? parseInt(rangeInput.value) || 50 : 50;
  }

  function setupIframeCommunication() {
    // Listen for token and filters requests from iframe
    window.addEventListener('message', async (event) => {
      if (event.origin !== new URL(APP_URL).origin) return;
      
      if (event.data.type === 'REQUEST_TOKEN') {
        const token = getTokenFromStorage();
        const iframe = panel.querySelector('.larry-panel-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'TOKEN_RESPONSE',
            token: token
          }, APP_URL);
        }
      }
      
      if (event.data.type === 'REQUEST_FILTERS') {
        const filters = await parseFiltersFromPage();
        const iframe = panel.querySelector('.larry-panel-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'FILTERS_RESPONSE',
            filters: filters
          }, APP_URL);
        }
      }
      
      // Handle offer search and click requests
      if (event.data.type === 'FIND_AND_CLICK_OFFER') {
        const { offerId, companyName, loadingCity, unloadingCity } = event.data;
        console.log('Larry Extension: Searching for offer on main page:', { offerId, companyName, loadingCity, unloadingCity });
        
        try {
          const found = await findAndClickOfferOnPage(offerId, companyName, loadingCity, unloadingCity);
          const iframe = panel.querySelector('.larry-panel-iframe');
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              type: 'OFFER_SEARCH_RESULT',
              found: found,
              offerId: offerId
            }, APP_URL);
          }
        } catch (error) {
          console.error('Larry Extension: Error finding offer:', error);
          const iframe = panel.querySelector('.larry-panel-iframe');
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              type: 'OFFER_SEARCH_RESULT',
              found: false,
              offerId: offerId,
              error: error.message
            }, APP_URL);
          }
        }
      }
    });
    
    // Start polling for filter changes every 2 seconds
    startFilterPolling();
  }

  // Polling mechanism: scan page for filter changes every 2 seconds
  let lastFiltersHash = '';
  let pollingInterval = null;
  
  function startFilterPolling() {
    if (pollingInterval) return; // Already polling
    
    pollingInterval = setInterval(async () => {
      if (!isOpen || !panel) return; // Only poll when panel is visible
      
      try {
        const filters = await parseFiltersFromPage();
        const currentHash = JSON.stringify(filters);
        
        // Only send update if filters actually changed
        if (currentHash !== lastFiltersHash) {
          console.log('Larry Extension: Filters changed on page, updating app...');
          lastFiltersHash = currentHash;
          
          const iframe = panel.querySelector('.larry-panel-iframe');
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              type: 'FILTERS_RESPONSE',
              filters: filters
            }, APP_URL);
          }
        }
      } catch (error) {
        console.warn('Larry Extension: Polling error:', error);
      }
    }, 2000); // Every 2 seconds
    
    console.log('Larry Extension: Filter polling started (every 2s)');
  }
  
  function stopFilterPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      console.log('Larry Extension: Filter polling stopped');
    }
  }

  function makeDraggable(element, handle) {
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      offsetX = e.clientX - element.offsetLeft;
      offsetY = e.clientY - element.offsetTop;
      element.style.transition = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
      if (!isDragging) return;
      element.style.left = (e.clientX - offsetX) + 'px';
      element.style.top = (e.clientY - offsetY) + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }

    function onMouseUp() {
      isDragging = false;
      element.style.transition = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  let isFullSize = false;

  function toggleSize() {
    if (!panel) return;
    isFullSize = !isFullSize;
    if (isFullSize) {
      panel.classList.add('larry-panel-full');
    } else {
      panel.classList.remove('larry-panel-full');
    }
  }

  async function show() {
    await createPanel();
    panel.classList.add('larry-panel-visible');
    isOpen = true;
    toggleBtn.classList.add('active');
  }

  function hide() {
    if (panel) {
      panel.classList.remove('larry-panel-visible');
    }
    isOpen = false;
    if (toggleBtn) toggleBtn.classList.remove('active');
    stopFilterPolling();
  }

  async function toggle() {
    if (isOpen) {
      hide();
    } else {
      await show();
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(async (message) => {
    if (message.action === 'toggle') {
      await toggle();
    }
  });

  // Initialize
  createToggleButton();

  // Function to find and click offer on the main page
  async function findAndClickOfferOnPage(offerId, companyName, loadingCity, unloadingCity) {
    console.log('Larry Extension: Starting search for offer:', { offerId, companyName, loadingCity, unloadingCity });
    
    // Strategy 1: Try to find by offer ID in data attributes or text content
    let offerElements = document.querySelectorAll('[data-offer-id], [data-id], .offer-row, .freight-row, tr');
    
    for (let element of offerElements) {
      // Check data attributes
      const dataId = element.getAttribute('data-offer-id') || 
                    element.getAttribute('data-id') || 
                    element.getAttribute('id');
      
      if (dataId && dataId.includes(offerId)) {
        console.log('Larry Extension: Found offer by ID:', dataId);
        await scrollToElementAndClick(element);
        return true;
      }
      
      // Check text content for company name and cities
      const textContent = element.textContent || '';
      const hasCompany = companyName && textContent.includes(companyName);
      const hasLoading = loadingCity && textContent.includes(loadingCity);
      const hasUnloading = unloadingCity && textContent.includes(unloadingCity);
      
      // If we find an element with company name and both cities, it's likely our offer
      if (hasCompany && hasLoading && hasUnloading) {
        console.log('Larry Extension: Found offer by content match:', { companyName, loadingCity, unloadingCity });
        await scrollToElementAndClick(element);
        return true;
      }
    }
    
    // Strategy 2: Look for table rows with city names
    const tableRows = document.querySelectorAll('table tr, .table-row, .offer-item');
    
    for (let row of tableRows) {
      const rowText = row.textContent || '';
      const hasLoading = loadingCity && rowText.includes(loadingCity);
      const hasUnloading = unloadingCity && rowText.includes(unloadingCity);
      
      // If we find a row with both cities, it might be our offer
      if (hasLoading && hasUnloading) {
        // Additional check: see if company name is also present (if available)
        if (!companyName || rowText.includes(companyName)) {
          console.log('Larry Extension: Found offer by cities in table row:', { loadingCity, unloadingCity });
          await scrollToElementAndClick(row);
          return true;
        }
      }
    }
    
    // Strategy 3: Search in any clickable elements that might contain offer info
    const clickableElements = document.querySelectorAll('a, button, .clickable, [onclick], [role="button"]');
    
    for (let element of clickableElements) {
      const elementText = element.textContent || '';
      const hasLoading = loadingCity && elementText.includes(loadingCity);
      const hasUnloading = unloadingCity && elementText.includes(unloadingCity);
      
      if (hasLoading && hasUnloading) {
        console.log('Larry Extension: Found offer in clickable element:', element);
        await scrollToElementAndClick(element);
        return true;
      }
    }
    
    console.log('Larry Extension: Offer not found on page');
    return false;
  }
  
  // Helper function to scroll to element and simulate click
  async function scrollToElementAndClick(element) {
    try {
      // Scroll element into view
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
      
      // Wait a bit for scroll to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Highlight the element briefly
      const originalStyle = element.style.cssText;
      element.style.cssText += 'background: #ffeb3b !important; transition: background 0.3s ease;';
      
      // Wait a bit to show highlight
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Simulate click
      element.click();
      
      // Also try triggering other events that might be needed
      const events = ['mousedown', 'mouseup', 'click'];
      events.forEach(eventType => {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window
        });
        element.dispatchEvent(event);
      });
      
      // Restore original style after a delay
      setTimeout(() => {
        element.style.cssText = originalStyle;
      }, 1000);
      
      console.log('Larry Extension: Successfully clicked element:', element);
      return true;
    } catch (error) {
      console.error('Larry Extension: Error clicking element:', error);
      return false;
    }
  }
})();
