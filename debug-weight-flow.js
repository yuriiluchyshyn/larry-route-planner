// Debug script to test the complete weight parsing flow
// Run this in browser console on Trans.eu page with Larry extension active

console.log('🔍 Larry Debug: Testing complete weight parsing flow...');

// Step 1: Test extension parsing
console.log('\n📋 Step 1: Testing extension parsing...');

// Simulate the extension parsing function
async function testExtensionParsing() {
  const filters = {
    loadingPoints: [],
    unloadingPoints: [],
    minWeight: null,
    maxWeight: null,
    minCapacity: null,
    maxCapacity: null,
    vehicleTypes: [],
    freightTypes: [],
    placesMatchingType: 'cross'
  };

  console.log('Larry Extension: Starting weight parsing...');
  
  // Try exact selectors first
  let weightFromInput = document.querySelector('[data-ctx="load_weight.valueFrom"] input');
  let weightToInput = document.querySelector('[data-ctx="load_weight.valueTo"] input');
  
  // Try specific IDs from HTML
  if (!weightFromInput) {
    weightFromInput = document.querySelector('input[id=":r4:"]');
  }
  if (!weightToInput) {
    weightToInput = document.querySelector('input[id=":r5:"]');
  }
  
  console.log('Larry Extension: Weight inputs found:');
  console.log('- weightFromInput:', weightFromInput, 'value:', weightFromInput?.value, 'id:', weightFromInput?.id);
  console.log('- weightToInput:', weightToInput, 'value:', weightToInput?.value, 'id:', weightToInput?.id);
  
  // Parse weight values
  if (weightFromInput) {
    const rawValue = weightFromInput.value;
    console.log('Larry Extension: Processing minWeight - raw value:', `"${rawValue}"`);
    if (rawValue && rawValue.trim()) {
      const minWeightValue = parseFloat(rawValue.replace(',', '.'));
      console.log('Larry Extension: Parsed minWeight value:', minWeightValue);
      if (minWeightValue && minWeightValue > 0) {
        filters.minWeight = minWeightValue;
        console.log('Larry Extension: ✅ Set minWeight to:', filters.minWeight);
      }
    }
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
      }
    }
  }
  
  return filters;
}

// Step 2: Test message passing
console.log('\n📨 Step 2: Testing message passing...');

function testMessagePassing(filters) {
  console.log('Larry: Sending filters to app:', filters);
  
  // Simulate what the extension sends
  const message = {
    type: 'FILTERS_RESPONSE',
    filters: filters
  };
  
  // Find Larry iframe
  const larryPanel = document.getElementById('larry-route-planner-panel');
  const iframe = larryPanel?.querySelector('iframe');
  
  if (iframe && iframe.contentWindow) {
    console.log('Larry: Found iframe, sending message...');
    iframe.contentWindow.postMessage(message, '*');
    return true;
  } else {
    console.log('Larry: ❌ No iframe found');
    return false;
  }
}

// Step 3: Test API filter building
console.log('\n🔧 Step 3: Testing API filter building...');

function testApiFilterBuilding(config) {
  console.log('Larry: Building API filter with config:', config);
  
  const filter = {
    loading_place: [],
    unloading_place: [],
    places_matching_type: "cross",
    exclude_suspended: true,
  };

  // Add weight filter only if values are provided
  const weightFilter = {};
  if (config.minWeight !== undefined && config.minWeight > 0) {
    weightFilter.from = config.minWeight;
  }
  if (config.maxWeight !== undefined && config.maxWeight > 0) {
    weightFilter.to = config.maxWeight;
  }
  if (Object.keys(weightFilter).length > 0) {
    filter.load_weight = weightFilter;
  }

  // Add capacity filter only if values are provided
  const capacityFilter = {};
  if (config.minCapacity !== undefined && config.minCapacity > 0) {
    capacityFilter.from = config.minCapacity;
  }
  if (config.maxCapacity !== undefined && config.maxCapacity > 0) {
    capacityFilter.to = config.maxCapacity;
  }
  if (Object.keys(capacityFilter).length > 0) {
    filter.cargo_capacity = capacityFilter;
  }

  console.log('Larry: Final API filter:', filter);
  return filter;
}

// Run the complete test
async function runCompleteTest() {
  try {
    // Step 1: Parse from page
    const filters = await testExtensionParsing();
    console.log('\n✅ Extension parsing result:', filters);
    
    // Step 2: Send to app
    const messageSent = testMessagePassing(filters);
    console.log('\n✅ Message passing result:', messageSent);
    
    // Step 3: Build API filter
    const mockConfig = {
      minWeight: filters.minWeight,
      maxWeight: filters.maxWeight,
      minCapacity: filters.minCapacity,
      maxCapacity: filters.maxCapacity
    };
    const apiFilter = testApiFilterBuilding(mockConfig);
    console.log('\n✅ API filter building result:', apiFilter);
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Min Weight: ${filters.minWeight !== null ? filters.minWeight : 'NOT FOUND'}`);
    console.log(`Max Weight: ${filters.maxWeight !== null ? filters.maxWeight : 'NOT FOUND'}`);
    console.log(`Min Capacity: ${filters.minCapacity !== null ? filters.minCapacity : 'NOT FOUND'}`);
    console.log(`Max Capacity: ${filters.maxCapacity !== null ? filters.maxCapacity : 'NOT FOUND'}`);
    console.log(`Message Sent: ${messageSent ? 'YES' : 'NO'}`);
    console.log(`API Weight Filter: ${JSON.stringify(apiFilter.load_weight || 'NO WEIGHT FILTER')}`);
    console.log(`API Capacity Filter: ${JSON.stringify(apiFilter.cargo_capacity || 'NO CAPACITY FILTER')}`);
    console.log('='.repeat(50));
    
    if (filters.maxWeight === 3.5) {
      console.log('🎉 SUCCESS: Weight parsing is working correctly!');
    } else {
      console.log('❌ ISSUE: Expected maxWeight to be 3.5, got:', filters.maxWeight);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
runCompleteTest();

// Also provide manual test functions
window.debugLarryWeight = {
  testExtensionParsing,
  testMessagePassing,
  testApiFilterBuilding,
  runCompleteTest
};

console.log('\n💡 Manual testing functions available:');
console.log('- debugLarryWeight.testExtensionParsing()');
console.log('- debugLarryWeight.testMessagePassing(filters)');
console.log('- debugLarryWeight.testApiFilterBuilding(config)');
console.log('- debugLarryWeight.runCompleteTest()');