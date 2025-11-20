import React, {useEffect, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ThemePreference, useTheme} from '../ThemeProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {loadAvailableMockTracks} from '../helpers/mockTrackManager';
import {MockTrack} from '../helpers/mockLocationProvider';

const PREFS: ThemePreference[] = ['system', 'light', 'dark'];
const PLAYBACK_SPEEDS = [0.5, 1, 2, 5, 10];

const MOCK_GPS_ENABLED_KEY = '@track_coach:mock_gps_enabled';
const MOCK_GPS_TRACK_ID_KEY = '@track_coach:mock_gps_track_id';
const MOCK_GPS_SPEED_KEY = '@track_coach:mock_gps_speed';

const SettingsScreen: React.FC = () => {
    const {preference, mode, setPreference, colors} = useTheme();

    // Mock GPS settings
    const [mockGpsEnabled, setMockGpsEnabled] = useState(false);
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [availableTracks, setAvailableTracks] = useState<MockTrack[]>([]);

    // Load settings
    useEffect(() => {
        loadSettings();
        loadTracks();
    }, []);

    const loadSettings = async () => {
        try {
            const [enabled, trackId, speed] = await Promise.all([
                AsyncStorage.getItem(MOCK_GPS_ENABLED_KEY),
                AsyncStorage.getItem(MOCK_GPS_TRACK_ID_KEY),
                AsyncStorage.getItem(MOCK_GPS_SPEED_KEY),
            ]);

            if (enabled) setMockGpsEnabled(enabled === 'true');
            if (trackId) setSelectedTrackId(trackId);
            if (speed) setPlaybackSpeed(parseFloat(speed));
        } catch (error) {
            console.error('Failed to load mock GPS settings:', error);
        }
    };

    const loadTracks = async () => {
        try {
            const tracks = await loadAvailableMockTracks();
            setAvailableTracks(tracks);

            // Auto-select first track if none selected
            if (!selectedTrackId && tracks.length > 0) {
                setSelectedTrackId(tracks[0].trackId);
            }
        } catch (error) {
            console.error('Failed to load mock tracks:', error);
        }
    };

    const toggleMockGps = async (value: boolean) => {
        if (value && availableTracks.length === 0) {
            Alert.alert('No Tracks', 'No mock tracks available. Please add a track first.');
            return;
        }

        setMockGpsEnabled(value);
        await AsyncStorage.setItem(MOCK_GPS_ENABLED_KEY, value.toString());

        if (value) {
            Alert.alert(
                'Mock GPS Enabled',
                '⚠️ Using simulated GPS data. Real GPS is disabled.\n\nRestart the app for changes to take effect.',
                [{text: 'OK'}]
            );
        }
    };

    const selectTrack = async (trackId: string) => {
        setSelectedTrackId(trackId);
        await AsyncStorage.setItem(MOCK_GPS_TRACK_ID_KEY, trackId);
    };

    const selectSpeed = async (speed: number) => {
        setPlaybackSpeed(speed);
        await AsyncStorage.setItem(MOCK_GPS_SPEED_KEY, speed.toString());
    };

    return (
        <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Appearance Section */}
                <Text style={[styles.heading, {color: colors.text}]}>Appearance</Text>
                <Text style={[styles.desc, {color: colors.secondaryText}]}>Effective mode: {mode}</Text>
                {PREFS.map(p => (
                    <Pressable
                        key={p}
                        onPress={() => setPreference(p)}
                        style={({pressed}) => [
                            styles.option,
                            {
                                borderColor: colors.border,
                                backgroundColor: preference === p ? colors.accent : colors.surface,
                                opacity: pressed ? 0.75 : 1,
                            },
                        ]}
                    >
                        <Text style={{
                            color: preference === p ? colors.white : colors.text,
                            fontWeight: preference === p ? '600' : '400'
                        }}>
                            {p === 'system' ? 'System default' : p.charAt(0).toUpperCase() + p.slice(1)}
                        </Text>
                    </Pressable>
                ))}

                {/* Debug Section */}
                <View style={styles.sectionDivider}/>
                <Text style={[styles.heading, {color: colors.text}]}>🔧 Debug Mode</Text>
                <Text style={[styles.desc, {color: colors.secondaryText}]}>
                    Test lap timing with simulated GPS data
                </Text>

                {/* Mock GPS Toggle */}
                <View style={[styles.settingRow, {borderColor: colors.border}]}>
                    <View style={styles.settingLeft}>
                        <Text style={[styles.settingLabel, {color: colors.text}]}>
                            Mock GPS Mode
                        </Text>
                        <Text style={[styles.settingDesc, {color: colors.secondaryText}]}>
                            {mockGpsEnabled ? '✅ Simulated GPS active' : 'Use real GPS data'}
                        </Text>
                    </View>
                    <Switch
                        value={mockGpsEnabled}
                        onValueChange={toggleMockGps}
                        trackColor={{false: colors.border, true: colors.accent}}
                        thumbColor={colors.white}
                    />
                </View>

                {mockGpsEnabled && (
                    <>
                        {/* Track Selection */}
                        <Text style={[styles.subheading, {color: colors.text}]}>Select Track</Text>
                        {availableTracks.map(track => (
                            <Pressable
                                key={track.trackId}
                                onPress={() => selectTrack(track.trackId)}
                                style={({pressed}) => [
                                    styles.option,
                                    {
                                        borderColor: colors.border,
                                        backgroundColor: selectedTrackId === track.trackId ? colors.accent : colors.surface,
                                        opacity: pressed ? 0.75 : 1,
                                    },
                                ]}
                            >
                                <Text style={{
                                    color: selectedTrackId === track.trackId ? colors.white : colors.text,
                                    fontWeight: selectedTrackId === track.trackId ? '600' : '400',
                                    fontSize: 15,
                                }}>
                                    {track.trackName}
                                </Text>
                                {track.description && (
                                    <Text style={{
                                        color: selectedTrackId === track.trackId ? colors.white : colors.secondaryText,
                                        fontSize: 12,
                                        marginTop: 4,
                                        opacity: 0.8,
                                    }}>
                                        {track.description}
                                    </Text>
                                )}
                            </Pressable>
                        ))}

                        {/* Playback Speed */}
                        <Text style={[styles.subheading, {color: colors.text, marginTop: 16}]}>
                            Playback Speed
                        </Text>
                        <View style={styles.speedRow}>
                            {PLAYBACK_SPEEDS.map(speed => (
                                <Pressable
                                    key={speed}
                                    onPress={() => selectSpeed(speed)}
                                    style={({pressed}) => [
                                        styles.speedButton,
                                        {
                                            borderColor: colors.border,
                                            backgroundColor: playbackSpeed === speed ? colors.accent : colors.surface,
                                            opacity: pressed ? 0.75 : 1,
                                        },
                                    ]}
                                >
                                    <Text style={{
                                        color: playbackSpeed === speed ? colors.white : colors.text,
                                        fontWeight: playbackSpeed === speed ? '700' : '500',
                                        fontSize: 14,
                                    }}>
                                        {speed}x
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Info Panel */}
                        <View style={[styles.infoPanel, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                            <Text style={[styles.infoText, {color: colors.secondaryText}]}>
                                💡 <Text style={{fontWeight: '600'}}>How it works:</Text>
                                {'\n'}• App will simulate GPS positions from selected track
                                {'\n'}• All sensors (accelerometer, gyro) work normally
                                {'\n'}• Test lap timing without being on the real track
                                {'\n'}• Restart app after changing settings
                            </Text>
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {flex: 1, padding: 24},
    heading: {fontSize: 22, fontWeight: '600', marginBottom: 12},
    subheading: {fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 8},
    desc: {fontSize: 14, marginBottom: 16},
    option: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 12
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 24,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
    },
    settingLeft: {
        flex: 1,
        marginRight: 12,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    settingDesc: {
        fontSize: 13,
    },
    speedRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    speedButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        minWidth: 60,
        alignItems: 'center',
    },
    infoPanel: {
        padding: 16,
        borderRadius: 10,
        borderWidth: 1,
        marginTop: 16,
    },
    infoText: {
        fontSize: 13,
        lineHeight: 20,
    },
});

export default SettingsScreen;
