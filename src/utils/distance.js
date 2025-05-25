/**
 * Calculate the distance between two points using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 * @param {number} degrees 
 * @returns {number} Radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Find the nearest shelter to a given location
 * @param {Object} userLocation - {latitude, longitude}
 * @param {Array} shelters - Array of shelter objects
 * @returns {Object} Nearest shelter with distance
 */
export function findNearestShelter(userLocation, shelters) {
  if (!userLocation || !shelters.length) return null;
  
  let nearest = null;
  let minDistance = Infinity;
  
  shelters.forEach(shelter => {
    const distance = haversine(
      userLocation.latitude,
      userLocation.longitude,
      shelter.latitude,
      shelter.longitude
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearest = { ...shelter, distance };
    }
  });
  
  return nearest;
}

/**
 * Check if a location is within a certain distance of user
 * @param {Object} userLocation - {latitude, longitude}
 * @param {Object} targetLocation - {latitude, longitude}
 * @param {number} maxDistance - Maximum distance in km
 * @returns {boolean}
 */
export function isNearby(userLocation, targetLocation, maxDistance = 50) {
  if (!userLocation || !targetLocation) return false;
  
  const distance = haversine(
    userLocation.latitude,
    userLocation.longitude,
    targetLocation.latitude,
    targetLocation.longitude
  );
  
  return distance <= maxDistance;
}
