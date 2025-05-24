import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import MapView, { Marker, Polygon, Circle } from 'react-native-maps';
import { theme } from '../theme';
import { useAlerts } from '../contexts/AlertsContext';
import { findNearestShelter } from '../utils/distance';
import { categorizeAlert, getGeometryCentroid } from '../utils/categorizeAlert';

export default function MapScreen() {
  const { earthquakes, alerts, shelters, userLocation } = useAlerts();
  const [showLegend, setShowLegend] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState({
    earthquake: true,
    flood: true,
    wildfire: true,
    tornado: true,
    storm: true,
    other: true,
  });

  const nearestShelter = userLocation ? findNearestShelter(userLocation, shelters) : null;

  const toggleLayer = (layer) => {
    setVisibleLayers(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  };

  const openDirections = (shelter) => {
    const url = `https://maps.google.com/maps?daddr=${shelter.latitude},${shelter.longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open directions');
    });
  };

  const getHazardColor = (type) => {
    return theme.colors[type] || theme.colors.other;
  };

  const renderEarthquakeMarkers = () => {
    if (!visibleLayers.earthquake) return null;
    
    return earthquakes.map((earthquake) => {
      const [longitude, latitude] = earthquake.geometry.coordinates;
      const magnitude = earthquake.properties.mag;
      
      return (
        <Circle
          key={earthquake.id}
          center={{ latitude, longitude }}
          radius={magnitude * 5000} // magnitude * 5km in meters
          fillColor={`${theme.colors.earthquake}40`} // 25% opacity
          strokeColor={theme.colors.earthquake}
          strokeWidth={2}
        />
      );
    });
  };

  const renderAlertPolygons = () => {
    return alerts.map((alert) => {
      const category = categorizeAlert(alert);
      
      if (!visibleLayers[category]) return null;
      
      const geometry = alert.geometry;
      if (!geometry || geometry.type !== 'Polygon') return null;
      
      const coordinates = geometry.coordinates[0].map(([longitude, latitude]) => ({
        latitude,
        longitude,
      }));
      
      return (
        <Polygon
          key={alert.id}
          coordinates={coordinates}
          fillColor={`${getHazardColor(category)}40`} // 25% opacity
          strokeColor={getHazardColor(category)}
          strokeWidth={2}
        />
      );
    });
  };

  const renderShelterMarkers = () => {
    return shelters.map((shelter) => (
      <Marker
        key={shelter.id}
        coordinate={{
          latitude: shelter.latitude,
          longitude: shelter.longitude,
        }}
        title={shelter.name}
        description={shelter.address}
        pinColor="#2196F3"
      />
    ));
  };

  const initialRegion = userLocation ? {
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  } : {
    // Fallback to Cupertino, CA
    latitude: 37.3230,
    longitude: -122.0322,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {renderShelterMarkers()}
        {renderEarthquakeMarkers()}
        {renderAlertPolygons()}
      </MapView>

      {/* Legend Toggle Button */}
      <TouchableOpacity
        style={styles.legendButton}
        onPress={() => setShowLegend(!showLegend)}
      >
        <Text style={styles.legendButtonText}>
          {showLegend ? '✕' : '☰'}
        </Text>
      </TouchableOpacity>

      {/* Legend */}
      {showLegend && (
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Hazard Layers</Text>
          {Object.entries(visibleLayers).map(([layer, visible]) => (
            <TouchableOpacity
              key={layer}
              style={styles.legendItem}
              onPress={() => toggleLayer(layer)}
            >
              <View
                style={[
                  styles.legendColor,
                  { backgroundColor: getHazardColor(layer) },
                  !visible && styles.legendColorDisabled
                ]}
              />
              <Text style={[
                styles.legendText,
                !visible && styles.legendTextDisabled
              ]}>
                {layer.charAt(0).toUpperCase() + layer.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Nearest Shelter Card */}
      {nearestShelter && (
        <View style={styles.shelterCard}>
          <Text style={styles.shelterCardTitle}>Nearest Shelter</Text>
          <Text style={styles.shelterName}>{nearestShelter.name}</Text>
          <Text style={styles.shelterDistance}>
            {nearestShelter.distance.toFixed(1)} km away
          </Text>
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => openDirections(nearestShelter)}
          >
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  legendButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: theme.colors.surface,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  legendButtonText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  legend: {
    position: 'absolute',
    top: 80,
    right: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minWidth: 150,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  legendTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: theme.spacing.sm,
  },
  legendColorDisabled: {
    opacity: 0.3,
  },
  legendText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  legendTextDisabled: {
    opacity: 0.5,
  },
  shelterCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  shelterCardTitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  shelterName: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  shelterDistance: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  directionsButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  directionsButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '600',
  },
});
