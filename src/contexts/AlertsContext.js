import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { categorizeAlert, getGeometryCentroid } from '../utils/categorizeAlert';
import { isNearby } from '../utils/distance';
import sheltersData from '../data/shelters.json';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const AlertsContext = createContext();

const initialState = {
  earthquakes: [],
  alerts: [],
  shelters: sheltersData,
  userLocation: null,
  loading: false,
  error: null,
  lastUpdated: null,
  autoRefreshEnabled: true,
  connectionStatus: 'connected',
};

function alertsReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    case 'SET_USER_LOCATION':
      return { ...state, userLocation: action.payload };
    case 'SET_AUTO_REFRESH':
      return { ...state, autoRefreshEnabled: action.payload };
    case 'SET_DATA':
      return { 
        ...state, 
        earthquakes: action.payload.earthquakes,
        alerts: action.payload.alerts,
        lastUpdated: action.payload.lastUpdated,
        loading: false,
        error: null,
        connectionStatus: 'connected',
      };
    case 'SET_CACHED_DATA':
      return {
        ...state,
        earthquakes: action.payload.earthquakes,
        alerts: action.payload.alerts,
        lastUpdated: action.payload.lastUpdated,
        connectionStatus: 'offline',
      };
    default:
      return state;
  }
}

export function AlertsProvider({ children }) {
  const [state, dispatch] = useReducer(alertsReducer, initialState);
  const refreshIntervalRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  useEffect(() => {
    initializeApp();
    return cleanup;
  }, []);

  useEffect(() => {
    if (state.autoRefreshEnabled && state.userLocation) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
    return () => stopAutoRefresh();
  }, [state.autoRefreshEnabled, state.userLocation]);

  const initializeApp = async () => {
    await requestNotificationPermissions();
    await loadCachedData();
  };

  const cleanup = () => {
    stopAutoRefresh();
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
  };

  const startAutoRefresh = () => {
    stopAutoRefresh();
    // Refresh every 5 minutes
    refreshIntervalRef.current = setInterval(() => {
      refreshData(true); // Silent refresh
    }, 5 * 60 * 1000);
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  };

  const loadCachedData = async () => {
    try {
      const cachedData = await AsyncStorage.getItem('alertsData');
      if (cachedData) {
        const data = JSON.parse(cachedData);
        dispatch({ type: 'SET_CACHED_DATA', payload: data });
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  };

  const cacheData = async (earthquakes, alerts) => {
    try {
      const data = {
        earthquakes,
        alerts,
        lastUpdated: new Date().toISOString()
      };
      await AsyncStorage.setItem('alertsData', JSON.stringify(data));
    } catch (error) {
      console.error('Error caching data:', error);
    }
  };

  const checkForNewNearbyAlerts = async (newAlerts, newEarthquakes) => {
    if (!state.userLocation) return;

    try {
      const cachedData = await AsyncStorage.getItem('alertsData');
      const previousData = cachedData ? JSON.parse(cachedData) : { earthquakes: [], alerts: [] };
      
      // Combine all hazards
      const allNewHazards = [
        ...newEarthquakes.map(eq => ({
          id: eq.id,
          type: 'earthquake',
          location: { latitude: eq.geometry.coordinates[1], longitude: eq.geometry.coordinates[0] },
          event: `Magnitude ${eq.properties.mag} Earthquake`,
          severity: eq.properties.mag >= 4.0 ? 'critical' : 'moderate',
        })),
        ...newAlerts.map(alert => {
          const category = categorizeAlert(alert);
          return {
            id: alert.id,
            type: category,
            location: getGeometryCentroid(alert.geometry),
            event: alert.properties.event,
            severity: getCriticalEvents().includes(category) ? 'critical' : 'moderate',
          };
        })
      ];

      const allPreviousHazards = [
        ...previousData.earthquakes.map(eq => ({ id: eq.id })),
        ...previousData.alerts.map(alert => ({ id: alert.id }))
      ];

      // Find new nearby hazards
      for (const hazard of allNewHazards) {
        const isNew = !allPreviousHazards.find(prev => prev.id === hazard.id);
        const isNearUser = hazard.location && isNearby(state.userLocation, hazard.location, 50);
        
        if (isNew && isNearUser) {
          const notificationTitle = hazard.severity === 'critical' 
            ? '🚨 CRITICAL ALERT' 
            : '⚠️ SafeSpot Alert';
          
          await Notifications.scheduleNotificationAsync({
            content: {
              title: notificationTitle,
              body: `${hazard.event} detected near your location`,
              sound: true,
              priority: hazard.severity === 'critical' ? 'high' : 'normal',
            },
            trigger: null,
          });
        }
      }
    } catch (error) {
      console.error('Error checking for new alerts:', error);
    }
  };

  const getCriticalEvents = () => ['earthquake', 'wildfire', 'tornado'];

  const fetchWithRetry = async (url, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const response = await fetch(url, { 
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
  };

  const fetchEarthquakes = async () => {
    try {
      const data = await fetchWithRetry('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson');
      return data.features || [];
    } catch (error) {
      console.error('Error fetching earthquakes:', error);
      throw new Error('Failed to fetch earthquake data');
    }
  };

  const fetchAlerts = async () => {
    try {
      const data = await fetchWithRetry('https://api.weather.gov/alerts/active?status=actual&message_type=alert');
      return data.features || [];
    } catch (error) {
      console.error('Error fetching alerts:', error);
      throw new Error('Failed to fetch weather alerts');
    }
  };

  const refreshData = async (silent = false) => {
    if (!silent) {
      dispatch({ type: 'SET_LOADING', payload: true });
    }
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const [earthquakes, alerts] = await Promise.all([
        fetchEarthquakes(),
        fetchAlerts()
      ]);

      // Check for new nearby alerts before updating state
      await checkForNewNearbyAlerts(alerts, earthquakes);

      dispatch({ type: 'SET_DATA', payload: {
        earthquakes,
        alerts,
        lastUpdated: new Date().toISOString()
      }});

      // Cache the new data
      await cacheData(earthquakes, alerts);

      // Clear any retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

    } catch (error) {
      const errorMessage = error.message || 'Network connection failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'offline' });
      
      // Auto-retry after 30 seconds if not silent
      if (!silent) {
        retryTimeoutRef.current = setTimeout(() => {
          refreshData(true);
        }, 30000);
      }
    }
  };

  const setUserLocation = (location) => {
    dispatch({ type: 'SET_USER_LOCATION', payload: location });
  };

  const setAutoRefresh = (enabled) => {
    dispatch({ type: 'SET_AUTO_REFRESH', payload: enabled });
  };

  const getNearbyHazards = () => {
    if (!state.userLocation) return [];

    const nearbyHazards = [];

    // Check earthquakes
    state.earthquakes.forEach(earthquake => {
      const eqLocation = {
        latitude: earthquake.geometry.coordinates[1],
        longitude: earthquake.geometry.coordinates[0]
      };
      
      if (isNearby(state.userLocation, eqLocation, 50)) {
        nearbyHazards.push({
          id: earthquake.id,
          type: 'earthquake',
          event: `Magnitude ${earthquake.properties.mag} Earthquake`,
          location: eqLocation,
          magnitude: earthquake.properties.mag,
          time: earthquake.properties.time,
          severity: earthquake.properties.mag >= 4.0 ? 'critical' : 'moderate',
        });
      }
    });

    // Check weather alerts
    state.alerts.forEach(alert => {
      const alertLocation = getGeometryCentroid(alert.geometry);
      
      if (alertLocation && isNearby(state.userLocation, alertLocation, 50)) {
        const category = categorizeAlert(alert);
        nearbyHazards.push({
          id: alert.id,
          type: category,
          event: alert.properties.event,
          location: alertLocation,
          geometry: alert.geometry,
          effective: alert.properties.effective,
          ends: alert.properties.ends,
          severity: getCriticalEvents().includes(category) ? 'critical' : 'moderate',
        });
      }
    });

    return nearbyHazards.sort((a, b) => {
      // Sort by severity first, then by type
      if (a.severity !== b.severity) {
        return a.severity === 'critical' ? -1 : 1;
      }
      return a.type.localeCompare(b.type);
    });
  };

  const value = {
    ...state,
    refreshData,
    setUserLocation,
    setAutoRefresh,
    getNearbyHazards,
  };

  return (
    <AlertsContext.Provider value={value}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertsProvider');
  }
  return context;
}
