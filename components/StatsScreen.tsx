import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import * as Location from 'expo-location';
import {SafeAreaView} from 'react-native-safe-area-context';
import MapView, {Marker} from 'react-native-maps';
import {useTheme} from '../ThemeProvider';

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
            const {status} = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setPermission('denied');
                return;
            }
            setPermission('granted');
            const sub = await Location.watchPositionAsync(
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
            return () => {
                sub.remove();
                clearRetry();
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
                            showsUserLocation={Platform.OS === 'android'}
                        >
                            <Marker
                                coordinate={{latitude: coords.latitude, longitude: coords.longitude}}
                                title="Aktuální poloha"
                                description={`± ${coords.accuracy != null ? Math.round(coords.accuracy) + ' m' : '?'} `}
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
