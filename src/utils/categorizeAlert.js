/**
 * Categorize an alert based on its event type
 * @param {Object} alert - Alert object from NWS API
 * @returns {string} Category: earthquake, flood, wildfire, tornado, storm, or other
 */
export function categorizeAlert(alert) {
  const event = alert.properties?.event?.toLowerCase() || '';
  
  // Earthquake alerts come from USGS, not NWS
  if (alert.properties?.type === 'earthquake') {
    return 'earthquake';
  }
  
  // Flood-related events
  if (event.includes('flood') || 
      event.includes('flash flood') || 
      event.includes('river flood') || 
      event.includes('coastal flood')) {
    return 'flood';
  }
  
  // Fire-related events
  if (event.includes('fire') || 
      event.includes('red flag') || 
      event.includes('extreme fire')) {
    return 'wildfire';
  }
  
  // Tornado-related events
  if (event.includes('tornado') || 
      event.includes('funnel cloud')) {
    return 'tornado';
  }
  
  // Storm-related events
  if (event.includes('thunderstorm') || 
      event.includes('severe weather') || 
      event.includes('wind') || 
      event.includes('hail') || 
      event.includes('storm')) {
    return 'storm';
  }
  
  return 'other';
}

/**
 * Get the centroid of a geometry (point or polygon)
 * @param {Object} geometry - GeoJSON geometry
 * @returns {Object} {latitude, longitude} or null
 */
export function getGeometryCentroid(geometry) {
  if (!geometry || !geometry.coordinates) return null;
  
  if (geometry.type === 'Point') {
    const [lon, lat] = geometry.coordinates;
    return { latitude: lat, longitude: lon };
  }
  
  if (geometry.type === 'Polygon') {
    const coordinates = geometry.coordinates[0]; // Outer ring
    let latSum = 0;
    let lonSum = 0;
    
    coordinates.forEach(([lon, lat]) => {
      latSum += lat;
      lonSum += lon;
    });
    
    return {
      latitude: latSum / coordinates.length,
      longitude: lonSum / coordinates.length
    };
  }
  
  if (geometry.type === 'MultiPolygon') {
    // Use first polygon for simplicity
    const firstPolygon = geometry.coordinates[0][0];
    let latSum = 0;
    let lonSum = 0;
    
    firstPolygon.forEach(([lon, lat]) => {
      latSum += lat;
      lonSum += lon;
    });
    
    return {
      latitude: latSum / firstPolygon.length,
      longitude: lonSum / firstPolygon.length
    };
  }
  
  return null;
}
