import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { theme } from '../theme';
import { useAlerts } from '../contexts/AlertsContext';
import ChecklistModal from '../components/ChecklistModal';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';

import { initModel, predictSeverity } from '../utils/severityModel';

export default function HomeScreen({ navigation }) {
  const {
    refreshData, setUserLocation,
    getNearbyHazards, loading, lastUpdated, error
  } = useAlerts();

  const [showChecklist, setShowChecklist] = useState(false);
  const [locationPermission, setLocationPermission] = useState(null);

  useEffect(() => {
    // 1) Request location, refresh data
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status==='granted');
      let coords;
      if (status==='granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, altitude: loc.coords.altitude||0 };
      } else {
        coords = { latitude:37.3230, longitude:-122.0322, altitude:0 };
      }
      setUserLocation(coords);
      await refreshData();
      // 2) Initialize your ML model
      await initModel();
    })();
  }, []);

  // 3) Fetch hazards and compute ML severity
  const nearby = getNearbyHazards();
  const hazards = nearby.map(h => ({
    ...h,
    severity: predictSeverity({
      distance:  h.distanceMeters,           // assume getNearbyHazards gives this
      hazardType:h.type,
      magnitude: h.magnitude||0,
      waterDepth:h.waterDepth||0,
      windSpeed: h.windSpeed||0,
      elevation: h.userElevation||0,
      timeOfDay: new Date().getHours()
    })
  }));

  return (
    <LinearGradient colors={[theme.colors.primary, theme.colors.secondary]} style={{flex:1}}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshData}/>}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Nearby Hazards</Text>
          {hazards.map(h => (
            <Card key={h.id} style={styles.alertCard}>
              <Text style={styles.alertTitle}>{h.type.toUpperCase()}</Text>
              <Text style={styles.alertText}>Severity: {h.severity}/100</Text>
              <StatusBadge severity={h.severity}/>
            </Card>
          ))}
        </View>
      </ScrollView>
      <ChecklistModal visible={showChecklist} onClose={()=>setShowChecklist(false)}/>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex:1 },
  content: { padding: theme.spacing.lg },
  title: { fontSize:24, fontWeight:'600', marginBottom:12, color:theme.colors.textPrimary },
  alertCard: { marginBottom:theme.spacing.md },
  alertTitle: { fontSize:18, fontWeight:'500' },
  alertText: { fontSize:16, marginTop:4 }
});
