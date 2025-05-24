import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Polygon, Marker, Callout, Circle } from 'react-native-maps';
import { theme } from '../theme';
import { useAlerts } from '../contexts/AlertsContext';
import { findNearestShelter } from '../utils/distance';
import { categorizeAlert, getGeometryCentroid } from '../utils/categorizeAlert';
import { predictSeverity } from '../utils/severityModel';

export default function MapScreen() {
  const { earthquakes, alerts, shelters, userLocation } = useAlerts();
  const [selectedAlert, setSelectedAlert] = useState(null);

  // Render your alert polygons...
  const alertPolygons = alerts.map(alert => {
    const category = categorizeAlert(alert);
    if (alert.geometry?.type !== 'Polygon') return null;
    const coords = alert.geometry.coordinates[0].map(([lng,lat])=>({ latitude:lat, longitude:lng }));
    return (
      <Polygon
        key={alert.id}
        coordinates={coords}
        fillColor={`${theme.colors[category]}40`}
        strokeColor={theme.colors[category]}
        strokeWidth={2}
        tappable
        onPress={() => setSelectedAlert(alert.id)}
      />
    );
  });

  // Render a marker at each centroid:
  const alertMarkers = alerts.map(alert => {
    if (alert.geometry?.type !== 'Polygon') return null;
    const { latitude, longitude } = getGeometryCentroid(alert);
    const severity = predictSeverity({
      distance:  alert.distanceMeters,
      hazardType: categorizeAlert(alert),
      magnitude:  alert.properties.mag || 0,
      waterDepth: alert.properties.depth || 0,
      windSpeed:  alert.properties.windSpeed || 0,
      elevation:  userLocation.altitude||0,
      timeOfDay:  new Date().getHours()
    });
    return (
      <Marker key={`m-${alert.id}`} coordinate={{ latitude, longitude }}>
        <Callout>
          <View style={{ padding:6 }}>
            <Text style={{ fontWeight:'600' }}>Severity</Text>
            <Text>{severity} / 100</Text>
          </View>
        </Callout>
      </Marker>
    );
  });

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={{
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta:0.5, longitudeDelta:0.5
      }}>
        {alertPolygons}
        {alertMarkers}
        {/* ...your existing Circles and shelter markers */}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1 },
  map:      { flex:1 }
});
