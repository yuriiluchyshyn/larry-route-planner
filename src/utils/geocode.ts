/**
 * Reverse geocode coordinates to get city name using OpenStreetMap Nominatim
 */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ locality: string; postalCode: string; country: string }> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'LarryRoutePlanner/1.0',
        },
      }
    );

    if (!response.ok) {
      return { locality: '', postalCode: '', country: '' };
    }

    const data = await response.json();
    const address = data.address || {};

    const locality =
      address.city || address.town || address.village || address.municipality || '';
    const postalCode = address.postcode || '';

    // Map country code to Trans.eu format
    const countryCode = address.country_code?.toUpperCase() || '';
    const countryMap: Record<string, string> = {
      PL: '47_poland',
      DE: '21_germany',
      FR: '19_france',
      CZ: '16_czech_republic',
      SK: '56_slovakia',
      AT: '5_austria',
      NL: '43_netherlands',
      BE: '7_belgium',
      IT: '28_italy',
      ES: '58_spain',
      HU: '26_hungary',
      RO: '50_romania',
      BG: '10_bulgaria',
      HR: '25_croatia',
      SI: '57_slovenia',
      LT: '35_lithuania',
      LV: '34_latvia',
      EE: '18_estonia',
      DK: '17_denmark',
      SE: '59_sweden',
      FI: '20_finland',
      PT: '48_portugal',
      IE: '27_ireland',
      LU: '36_luxembourg',
      GR: '23_greece',
      UA: '63_ukraine',
      GB: '22_great_britain',
      CH: '60_switzerland',
      NO: '44_norway',
    };

    const country = countryMap[countryCode] || countryCode.toLowerCase();

    return { locality, postalCode, country };
  } catch {
    return { locality: '', postalCode: '', country: '' };
  }
}
