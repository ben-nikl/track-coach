import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import * as Location from 'expo-location';
import {SafeAreaView} from 'react-native-safe-area-context';
import MapView, {Marker} from 'react-native-maps';
import {useTheme} from '../ThemeProvider';
import {getMockLocationProvider} from '../helpers/mockLocationProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock GPS settings keys
const MOCK_GPS_ENABLED_KEY = '@track_coach:mock_gps_enabled';

interface Coords {
    latitude: number;
    longitude: number;
    accuracy?: number | null; // allow null from Location API
    altitude?: number | null;
    heading?: number | null;
    speed?: number | null;
    timestamp: number;
}

const StatsScreen: React.FC = () => {
    const {colors} = useTheme();
    const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
    const [loading, setLoading] = useState<boolean>(false);
    const [coords, setCoords] = useState<Coords | null>(null);
    const [error, setError] = useState<string | null>(null);
    const retryTimer = useRef<NodeJS.Timeout | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const MAX_RETRIES = 5;
    const [mapReady, setMapReady] = useState(false);
    const [mapTimeout, setMapTimeout] = useState(false);
    const [isMockActive, setIsMockActive] = useState(false);
    const [mockGpsEnabled, setMockGpsEnabled] = useState<boolean>(false);
    const [mockDebugInfo, setMockDebugInfo] = useState<{
        trackName: string;
        trackId: string;
        source: string;
        isActive: boolean;
        currentPoint: number;
        totalPoints: number;
        progress: number;
    } | null>(null);

    const clearRetry = () => {
        if (retryTimer.current) {
            clearTimeout(retryTimer.current);
            retryTimer.current = null;
        }
    };

    const scheduleRetryIfUnknown = (message: string) => {
        const isUnknown = message.includes('kCLErrorDomain error 0'); // kCLErrorLocationUnknown
        if (isUnknown && retryCount < MAX_RETRIES) {
            const next = retryCount + 1;
            setRetryCount(next);
            retryTimer.current = setTimeout(() => {
                fetchLocation(true);
            }, 2000);
        }
    };

    const fetchLocation = useCallback(async (isRetry: boolean = false) => {
        if (!isRetry) setRetryCount(0);
        setLoading(true);
        setError(null);
        try {
            const current = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced});
            setCoords({
                latitude: current.coords.latitude,
                longitude: current.coords.longitude,
                accuracy: current.coords.accuracy,
                altitude: current.coords.altitude,
                heading: current.coords.heading,
                speed: current.coords.speed,
                timestamp: current.timestamp,
            });
        } catch (e: any) {
            const msg = e?.message || 'Failed to get location';
            setError(msg);
            scheduleRetryIfUnknown(msg);
        } finally {
            setLoading(false);
        }
    }, [retryCount]);

    useEffect(() => () => clearRetry(), []);

    useEffect(() => {
        (async () => {
            // First check if mock GPS is enabled in settings
            const mockEnabled = await AsyncStorage.getItem(MOCK_GPS_ENABLED_KEY);
            const useMockGps = mockEnabled === 'true';
            setMockGpsEnabled(useMockGps);

            const {status} = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setPermission('denied');
                return;
            }
            setPermission('granted');

            const mockProvider = getMockLocationProvider();

            // If mock GPS is enabled, load the configured track
            if (useMockGps) {
                const [mockTrackId, mockSpeed] = await Promise.all([
                    AsyncStorage.getItem('@track_coach:mock_gps_track_id'),
                    AsyncStorage.getItem('@track_coach:mock_gps_speed'),
                ]);

                console.log('🔧 StatsScreen: Mock GPS enabled, track ID:', mockTrackId);

                // If no track is configured, use default track (Autodrom Most)
                const trackIdToLoad = mockTrackId || 'autodrom-most';

                if (trackIdToLoad !== mockTrackId) {
                    console.log('🔧 StatsScreen: No track configured, using default:', trackIdToLoad);
                }

                const {loadMockTrackById} = await import('../helpers/mockTrackManager');
                const mockTrack = await loadMockTrackById(trackIdToLoad);

                if (mockTrack) {
                    console.log('🔧 StatsScreen: Mock track loaded:', mockTrack.trackName, 'with', mockTrack.points.length, 'points');

                    // Determine source
                    const source = trackIdToLoad.startsWith('custom-')
                        ? 'Custom Session Export'
                        : `assets/mock-tracks/${trackIdToLoad}.json`;

                    // Load track into provider (but don't auto-start)
                    mockProvider.loadTrack({
                        track: mockTrack,
                        playbackSpeed: mockSpeed ? parseFloat(mockSpeed) : 1.0,
                        loop: true,
                        autoStart: false, // Load without auto-start
                    }, source);

                    console.log('🔧 StatsScreen: Loaded mock track for preview:', mockTrack.trackName, 'from', source);

                    // Show first point of track as initial position
                    const firstPoint = mockTrack.points[0];
                    if (firstPoint) {
                        const initialCoords = {
                            latitude: firstPoint.latitude,
                            longitude: firstPoint.longitude,
                            accuracy: firstPoint.accuracy,
                            altitude: firstPoint.altitude,
                            heading: firstPoint.heading,
                            speed: 0, // Not moving in preview
                            timestamp: Date.now(),
                        };
                        console.log('🔧 Setting coords from first point:', initialCoords.latitude, initialCoords.longitude);
                        setCoords(initialCoords);
                    } else {
                        console.warn('⚠️ No points in mock track!');
                    }

                    // Start mock GPS playback for live preview
                    mockProvider.start();
                    console.log('🔧 StatsScreen: Started mock GPS playback');

                    // If using default track, show warning
                    if (!mockTrackId) {
                        setError('Mock GPS zapnuto, ale žádný track není vybraný. Používám výchozí: ' + mockTrack.trackName);
                    }
                } else {
                    console.warn('⚠️ Mock track not found:', trackIdToLoad);
                    setError('Mock GPS: Track "' + trackIdToLoad + '" nebyl nalezen. Vyber track v nastavení.');
                }
            }

            // Subscribe to mock location updates
            const mockCallback = (location: Location.LocationObject) => {
                console.log('📍 Mock GPS callback received:', location.coords.latitude, location.coords.longitude);
                setCoords({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    accuracy: location.coords.accuracy,
                    altitude: location.coords.altitude,
                    heading: location.coords.heading,
                    speed: location.coords.speed,
                    timestamp: location.timestamp,
                });
                clearRetry();
                setError(null);
            };

            // Always add subscriber - it will be called only when mock is active
            mockProvider.addSubscriber(mockCallback);

            let sub: Location.LocationSubscription | null = null;

            // If mock GPS is disabled, use real GPS
            if (!useMockGps) {
                // Normal mode - use real GPS
                console.log('📍 StatsScreen: Using real GPS');
                sub = await Location.watchPositionAsync(
                    {accuracy: Location.Accuracy.Low, timeInterval: 5000, distanceInterval: 5},
                    pos => {
                        setCoords({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            accuracy: pos.coords.accuracy,
                            altitude: pos.coords.altitude,
                            heading: pos.coords.heading,
                            speed: pos.coords.speed,
                            timestamp: pos.timestamp,
                        });
                        clearRetry();
                        setError(null);
                    }
                );
                fetchLocation();
            } else {
                console.log('🔧 StatsScreen: Mock GPS enabled, showing preview (real GPS disabled)');
            }

            // Check mock status periodically
            const mockCheckInterval = setInterval(() => {
                const isActive = mockProvider.isActive();
                const debugInfo = mockProvider.getDebugInfo();
                setIsMockActive(isActive);
                setMockDebugInfo(debugInfo);
            }, 500); // Check every 500ms

            return () => {
                sub?.remove();
                clearRetry();
                mockProvider.removeSubscriber(mockCallback);
                clearInterval(mockCheckInterval);
            };
        })();
    }, [fetchLocation]);

    useEffect(() => {
        let t: NodeJS.Timeout | null = null;
        if (coords && !mapReady) {
            t = setTimeout(() => setMapTimeout(true), 4000);
        }
        return () => {
            if (t) clearTimeout(t);
        };
    }, [coords, mapReady]);

    if (permission === 'undetermined') {
        return (
            <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.background}]}>
                <View style={styles.center}>
                    <ActivityIndicator/>
                    <Text style={[styles.info, {color: colors.secondaryText}]}>Žádám o povolení k lokaci…</Text>
                </View>
            </SafeAreaView>
        );
    }
    if (permission === 'denied') {
        return (
            <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.background}]}>
                <View style={styles.center}>
                    <Text style={[styles.error, {color: colors.danger}]}>Přístup k GPS zamítnut. Povolit v
                        nastavení.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.background}]}>
            <View style={styles.wrapper}>
                <Text style={[styles.heading, {color: colors.text}]}>Aktuální poloha</Text>

                {mockDebugInfo && (
                    <View
                        style={[styles.mockDebugPanel, {backgroundColor: colors.surface, borderColor: colors.accent}]}>
                        <Text style={[styles.mockDebugTitle, {color: colors.accent}]}>
                            🔧 MOCK GPS {mockDebugInfo.isActive ? 'AKTIVNÍ' : 'NAČTENO (náhled)'}
                        </Text>
                        <Text style={[styles.mockDebugText, {color: colors.text}]}>
                            Track: {mockDebugInfo.trackName}
                        </Text>
                        <Text style={[styles.mockDebugText, {color: colors.secondaryText}]}>
                            Zdroj: {mockDebugInfo.source}
                        </Text>
                        <Text style={[styles.mockDebugText, {color: colors.secondaryText}]}>
                            ID: {mockDebugInfo.trackId}
                        </Text>
                        {mockDebugInfo.isActive && (
                            <>
                                <Text style={[styles.mockDebugText, {color: colors.secondaryText}]}>
                                    Progres: {(mockDebugInfo.progress * 100).toFixed(1)}%
                                    ({mockDebugInfo.currentPoint}/{mockDebugInfo.totalPoints} bodů)
                                </Text>
                            </>
                        )}
                    </View>
                )}

                {loading && (
                    <View style={styles.row}><ActivityIndicator size="small"/><Text
                        style={[styles.loadingLabel, {color: colors.secondaryText}]}>Načítám…</Text></View>
                )}
                {error && (
                    <Text
                        style={[styles.error, {color: error.includes('kCLErrorDomain') ? colors.secondaryText : colors.danger}]}>
                        {error.includes('kCLErrorDomain error 0')
                            ? `Poloha zatím není dostupná (pokus ${retryCount}/${MAX_RETRIES}). Čekám na fix…`
                            : error}
                    </Text>
                )}
                {coords && (
                    <View style={styles.block}>
                        <Text style={[styles.coord, {color: colors.text}]}>Lat: {coords.latitude.toFixed(6)}</Text>
                        <Text style={[styles.coord, {color: colors.text}]}>Lon: {coords.longitude.toFixed(6)}</Text>
                        {coords.accuracy != null && <Text
                            style={[styles.meta, {color: colors.secondaryText}]}>± {Math.round(coords.accuracy)} m</Text>}
                        {coords.altitude != null && <Text
                            style={[styles.meta, {color: colors.secondaryText}]}>Alt: {Math.round(coords.altitude)} m</Text>}
                        {coords.speed != null && <Text
                            style={[styles.meta, {color: colors.secondaryText}]}>Rychlost: {(coords.speed * 3.6).toFixed(1)} km/h</Text>}
                        <Text
                            style={[styles.meta, {color: colors.secondaryText}]}>{new Date(coords.timestamp).toLocaleTimeString()}</Text>
                    </View>
                )}
                <Pressable
                    style={({pressed}) => [styles.button, {backgroundColor: colors.accent}, pressed && styles.buttonPressed]}
                    onPress={() => fetchLocation()}>
                    <Text style={[styles.buttonText, {color: colors.white}]}>Obnovit</Text>
                </Pressable>
                {coords && !error && (
                    <View style={styles.mapWrapper}>
                        <MapView
                            style={[styles.map, {backgroundColor: colors.surface}]}
                            initialRegion={{
                                latitude: coords.latitude,
                                longitude: coords.longitude,
                                latitudeDelta: 0.005,
                                longitudeDelta: 0.005,
                            }}
                            region={{
                                latitude: coords.latitude,
                                longitude: coords.longitude,
                                latitudeDelta: 0.005,
                                longitudeDelta: 0.005,
                            }}
                            onMapReady={() => setMapReady(true)}
                            showsUserLocation={Platform.OS === 'android' && !isMockActive}
                        >
                            <Marker
                                coordinate={{latitude: coords.latitude, longitude: coords.longitude}}
                                title={isMockActive ? "Mock GPS Pozice" : "Aktuální poloha"}
                                description={`± ${coords.accuracy != null ? Math.round(coords.accuracy) + ' m' : '?'} `}
                                pinColor={isMockActive ? '#FF6B00' : undefined}
                            />
                        </MapView>
                        {!mapReady && !mapTimeout && (
                            <View
                                style={[styles.mapOverlay, {backgroundColor: colors.surface + 'CC'}]}><ActivityIndicator
                                size="small"/><Text style={[styles.mapOverlayText, {color: colors.text}]}>Inicializuji
                                mapu…</Text></View>
                        )}
                        {mapTimeout && !mapReady && (
                            <View style={[styles.mapOverlay, {backgroundColor: colors.surface}]}><Text
                                style={[styles.mapOverlayText, {color: colors.text}]}>Mapa se nenačetla. Zkuste
                                restartovat Expo / zkontrolovat react-native-maps.</Text></View>
                        )}
                    </View>
                )}
                {retryCount >= MAX_RETRIES && error?.includes('kCLErrorDomain error 0') && (
                    <Text style={[styles.meta, {color: colors.secondaryText}]}>Maximální počet automatických pokusů
                        dosažen. Zkuste ručně nastavit simulátor: Simulator → Features → Location.</Text>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {flex: 1},
    wrapper: {flex: 1, paddingHorizontal: 24, paddingTop: 16},
    center: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24},
    heading: {fontSize: 22, fontWeight: '600', marginBottom: 16},
    mockDebugPanel: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 2,
        marginBottom: 16,
        gap: 4,
    },
    mockDebugTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    mockDebugText: {
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    mockBadge: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 12,
    },
    mockBadgeText: {
        fontSize: 13,
        fontWeight: '600',
    },
    block: {marginBottom: 24},
    coord: {fontSize: 16, fontWeight: '500'},
    meta: {fontSize: 13},
    button: {paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignSelf: 'flex-start'},
    buttonPressed: {opacity: 0.7},
    buttonText: {fontWeight: '600', letterSpacing: 0.5},
    row: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12},
    loadingLabel: {marginLeft: 8, fontSize: 14},
    info: {marginTop: 12, fontSize: 14},
    error: {fontWeight: '500', marginTop: 12, textAlign: 'center'},
    mapWrapper: {position: 'relative', marginTop: 16, width: '100%', height: 220},
    map: {flex: 1, borderRadius: 12, overflow: 'hidden'},
    mapOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12
    },
    mapOverlayText: {marginTop: 8, fontSize: 12, textAlign: 'center'},
});

export default StatsScreen;
