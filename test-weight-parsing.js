// Test script for weight parsing in extension
// Run this in browser console on Trans.eu page to debug weight parsing

console.log('🧪 Larry Extension: Testing weight parsing...');

// Test all possible selectors for weight inputs
const weightSelectors = [
  '[data-ctx="load_weight.valueFrom"] input',
  '[data-ctx="load_weight.valueTo"] input',
  'input[name="valueFrom"][parentname="load_weight"]',
  'input[name="valueTo"][parentname="load_weight"]',
  'input[id=":r4:"]',
  'input[id=":r5:"]',
  'input[name*="weight"][name*="from"]',
  'input[name*="weight"][name*="to"]',
  'input[placeholder*="З"]',
  'input[placeholder*="До"]'
];

console.log('Testing weight selectors:');
weightSelectors.forEach((selector, index) => {
  const element = document.querySelector(selector);
  console.log(`${index + 1}. ${selector}:`, element, 'value:', element?.value);
});

// Test weight section detection
const weightSections = [
  '[data-ctx="load-weight"]',
  '.load-weight',
  '.weight-section',
  '[data-ctx="swithToWeight"]'
];

console.log('\nTesting weight sections:');
weightSections.forEach((selector, index) => {
  const element = document.querySelector(selector);
  console.log(`${index + 1}. ${selector}:`, element);
  if (element) {
    const inputs = element.querySelectorAll('input[type="text"]');
    console.log(`   - Found ${inputs.length} text inputs:`, Array.from(inputs).map(i => i.value));
  }
});

// Test the actual parsing logic
function testWeightParsing() {
  const filters = {
    minWeight: null,
    maxWeight: null
  };

  // Try primary selectors
  let weightFromInput = document.querySelector('[data-ctx="load_weight.valueFrom"] input');
  let weightToInput = document.querySelector('[data-ctx="load_weight.valueTo"] input');
  
  // Try alternative selectors
  if (!weightFromInput) {
    weightFromInput = document.querySelector('input[name="valueFrom"][parentname="load_weight"]') ||
                     document.querySelector('input[id=":r4:"]') ||
                     document.querySelector('input[name*="weight"][name*="from"]') ||
                     document.querySelector('input[placeholder*="З"]');
  }
  
  if (!weightToInput) {
    weightToInput = document.querySelector('input[id=":r5:"]') ||
                   document.querySelector('input[name="valueTo"][parentname="load_weight"]') ||
                   document.querySelector('input[name*="weight"][name*="to"]') ||
                   document.querySelector('input[placeholder*="До"]');
  }
  
  console.log('\n🎯 Final weight inputs found:');
  console.log('- weightFromInput:', weightFromInput, 'value:', weightFromInput?.value);
  console.log('- weightToInput:', weightToInput, 'value:', weightToInput?.value);
  
  // Parse values
  if (weightFromInput && weightFromInput.value && weightFromInput.value.trim()) {
    const minWeightValue = parseFloat(weightFromInput.value.replace(',', '.')) || null;
    if (minWeightValue && minWeightValue > 0) {
      filters.minWeight = minWeightValue;
    }
  }
  
  if (weightToInput && weightToInput.value && weightToInput.value.trim()) {
    const maxWeightValue = parseFloat(weightToInput.value.replace(',', '.')) || null;
    if (maxWeightValue && maxWeightValue > 0) {
      filters.maxWeight = maxWeightValue;
    }
  }
  
  console.log('\n✅ Parsed weight filters:', filters);
  return filters;
}

// Run the test
const result = testWeightParsing();

// Show results in a nice format
console.log('\n📊 RESULTS:');
console.log('='.repeat(50));
console.log(`Minimum Weight: ${result.minWeight || 'NOT FOUND'}`);
console.log(`Maximum Weight: ${result.maxWeight || 'NOT FOUND'}`);
console.log('='.repeat(50));

if (!result.minWeight && !result.maxWeight) {
  console.log('❌ No weight values found. Check if:');
  console.log('1. You are on the correct Trans.eu page with filters');
  console.log('2. Weight fields are filled in the form');
  console.log('3. The HTML structure matches expected selectors');
} else {
  console.log('✅ Weight parsing successful!');
}