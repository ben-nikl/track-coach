/**
 * Session Detail Screen
 *
 * Displays detailed statistics and lap table for a completed session
 */

import React, {useEffect, useRef, useState} from 'react';
import {Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Gesture, GestureDetector, GestureHandlerRootView} from 'react-native-gesture-handler';
import {useTheme} from '../ThemeProvider';
import {SessionRecord} from '../helpers/sessionStorageTypes';
import {calculateSessionSummary, loadSession} from '../helpers/sessionStorage';
import {formatLapTime} from './LapTimerScreen/format';
import LapTrajectoryViewer from './LapTrajectoryViewer';
import {TRACKS} from '../data/tracks';

interface SessionDetailScreenProps {
    sessionId: string;
    onBack?: () => void;
}

const SessionDetailScreen: React.FC<SessionDetailScreenProps> = ({sessionId, onBack}) => {
    const {colors} = useTheme();
    const [session, setSession] = useState<SessionRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewingLapIndex, setViewingLapIndex] = useState<number | null>(null);
    const [showHint, setShowHint] = useState(true);

    // Animation values for swipe feedback
    const swipeTranslateX = useRef(new Animated.Value(0)).current;
    const hintOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        loadSessionData();
    }, [sessionId]);

    // Auto-hide hint after 5 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            Animated.timing(hintOpacity, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }).start(() => setShowHint(false));
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    const loadSessionData = async () => {
        setLoading(true);
        try {
            const loadedSession = await loadSession(sessionId);
            setSession(loadedSession);
        } catch (error) {
            console.error('Failed to load session:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
                <Text style={[styles.loadingText, {color: colors.secondaryText}]}>Loading session...</Text>
            </SafeAreaView>
        );
    }

    if (!session) {
        return (
            <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
                <Text style={[styles.errorText, {color: colors.danger}]}>Session not found</Text>
            </SafeAreaView>
        );
    }

    // If viewing a specific lap trajectory, show the viewer
    if (viewingLapIndex !== null) {
        const track = TRACKS.find(t => t.id === session.trackId);
        if (!track) {
            // Track not found, go back to table
            setViewingLapIndex(null);
            return (
                <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
                    <Text style={[styles.errorText, {color: colors.danger}]}>Track data not found</Text>
                </SafeAreaView>
            );
        } else {
            return (
                <LapTrajectoryViewer
                    trackName={session.trackName}
                    trackLocation={session.trackLocation}
                    mapRegion={{
                        latitude: track.latitude,
                        longitude: track.longitude,
                        latitudeDelta: track.latitudeDelta,
                        longitudeDelta: track.longitudeDelta,
                    }}
                    startLine={track.startLine}
                    finishLine={track.finishLine}
                    sectors={track.sectors}
                    laps={session.laps}
                    initialLapIndex={viewingLapIndex}
                    bestLapTimeMs={session.bestLapTimeMs}
                    onBack={() => setViewingLapIndex(null)}
                />
            );
        }
    }

    const summary = calculateSessionSummary(session);
    const bestLapIndex = session.laps.findIndex(lap => lap.lapTimeMs === session.bestLapTimeMs);

    // Determine number of sectors from track definition, not from lap data
    const track = TRACKS.find(t => t.id === session.trackId);
    const numSectors = track ? track.sectors.length + 1 : (session.laps[0]?.sectorSplitsMs.length || 0);
    const bestSectorTimes = summary.optimalSectorTimes;

    // Ensure bestSectorTimes has the correct length
    while (bestSectorTimes.length < numSectors) {
        bestSectorTimes.push(0);
    }

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('cs-CZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Swipe gestures with animation
    const handleSwipeLeft = () => {
        // Swipe left - show map with trajectory of first lap
        if (session && session.laps.length > 0) {
            setViewingLapIndex(session.laps[0].lapIndex);
        }
    };

    const handleSwipeRight = () => {
        // Swipe right - go back to sessions list
        if (onBack) {
            onBack();
        }
    };

    const swipeGesture = Gesture.Pan()
        .activeOffsetX([-15, 15]) // Requires 15px horizontal movement before activating
        .failOffsetY([-30, 30]) // Fails if vertical movement exceeds 30px (was too strict at 10px)
        .onStart(() => {
            // Clear any ongoing animation
            swipeTranslateX.stopAnimation();
        })
        .onUpdate((e) => {
            // Animate during swipe with damped movement
            swipeTranslateX.setValue(e.translationX * 0.4); // Increased from 0.3 for more visible feedback
        })
        .onEnd((e) => {
            const threshold = 80; // minimum swipe distance
            const velocityThreshold = 500; // reduced from 800 for easier triggering

            let shouldNavigate = false;
            let direction: 'left' | 'right' | null = null;

            // Check if swipe was strong enough
            if (Math.abs(e.velocityX) > velocityThreshold || Math.abs(e.translationX) > threshold) {
                if (e.translationX > threshold && e.velocityX > 0) {
                    // Swipe right
                    shouldNavigate = true;
                    direction = 'right';
                } else if (e.translationX < -threshold && e.velocityX < 0) {
                    // Swipe left
                    shouldNavigate = true;
                    direction = 'left';
                }
            }

            // Animate back to center
            Animated.spring(swipeTranslateX, {
                toValue: 0,
                useNativeDriver: true,
                tension: 100,
                friction: 10,
            }).start(() => {
                // Navigate after animation completes
                if (shouldNavigate) {
                    if (direction === 'right') {
                        handleSwipeRight();
                    } else if (direction === 'left') {
                        handleSwipeLeft();
                    }
                }
            });
        })
        .onFinalize(() => {
            // Ensure animation is reset
            Animated.spring(swipeTranslateX, {
                toValue: 0,
                useNativeDriver: true,
            }).start();
        });

    return (
        <GestureHandlerRootView style={{flex: 1}}>
            <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]} edges={['top']}>
                <GestureDetector gesture={swipeGesture}>
                    <Animated.View
                        style={[
                            {flex: 1},
                            {transform: [{translateX: swipeTranslateX}]}
                        ]}
                    >
                        <ScrollView
                            contentContainerStyle={styles.content}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Back Button */}
                            {onBack && (
                                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                                    <Text style={[styles.backButtonText, {color: colors.accent}]}>← Back</Text>
                                </TouchableOpacity>
                            )}

                            {/* Swipe hint - minimalist design */}
                            {showHint && (
                                <Animated.View style={[styles.swipeHint, {opacity: hintOpacity}]}>
                                    <Text style={[styles.swipeHintText, {color: colors.secondaryText}]}>
                                        ← Mapa | Zpět →
                                    </Text>
                                </Animated.View>
                            )}

                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={[styles.title, {color: colors.text}]}>{session.trackName}</Text>
                                <Text
                                    style={[styles.subtitle, {color: colors.secondaryText}]}>{formatDate(session.startTime)}</Text>
                            </View>

                            {/* Summary Statistics */}
                            <View style={styles.summaryGrid}>
                                <View style={[styles.summaryCard, {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border
                                }]}>
                                    <Text style={[styles.summaryLabel, {color: colors.secondaryText}]}>Laps</Text>
                                    <Text style={[styles.summaryValue, {color: colors.text}]}>{summary.totalLaps}</Text>
                                </View>

                                <View style={[styles.summaryCard, {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border
                                }]}>
                                    <Text style={[styles.summaryLabel, {color: colors.secondaryText}]}>Time</Text>
                                    <Text
                                        style={[styles.summaryValue, {color: colors.text}]}>{formatLapTime(summary.totalTimeMs)}</Text>
                                </View>

                                <View style={[styles.summaryCard, {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border
                                }]}>
                                    <Text style={[styles.summaryLabel, {color: colors.secondaryText}]}>Distance</Text>
                                    <Text
                                        style={[styles.summaryValue, {color: colors.text}]}>{summary.totalDistanceKm.toFixed(1)} km</Text>
                                </View>

                                <View style={[styles.summaryCard, {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border
                                }]}>
                                    <Text style={[styles.summaryLabel, {color: colors.secondaryText}]}>Best Lap</Text>
                                    <Text
                                        style={[styles.summaryValue, {color: colors.warning}]}>{formatLapTime(summary.bestLapTimeMs)}</Text>
                                </View>
                            </View>

                            {/* Optimal Lap */}
                            <View style={[styles.optimalLapCard, {
                                backgroundColor: colors.surface,
                                borderColor: colors.border
                            }]}>
                                <View style={styles.optimalLapHeader}>
                                    <Text style={[styles.optimalLapLabel, {color: colors.secondaryText}]}>Optimal
                                        Lap</Text>
                                    <Text
                                        style={[styles.optimalLapTime, {color: colors.accent}]}>{formatLapTime(summary.optimalLapTimeMs)}</Text>
                                </View>
                                <View style={styles.optimalSectors}>
                                    {bestSectorTimes.map((time, idx) => (
                                        <View key={idx} style={styles.optimalSectorItem}>
                                            <Text
                                                style={[styles.optimalSectorLabel, {color: colors.secondaryText}]}>S{idx + 1}</Text>
                                            <Text
                                                style={[styles.optimalSectorTime, {color: colors.warning}]}>{formatLapTime(time)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            {/* Lap Table */}
                            <Text style={[styles.sectionTitle, {color: colors.text}]}>Lap Times</Text>
                            <Text style={[styles.tapHint, {color: colors.secondaryText}]}>Tap any lap to view trajectory
                                on
                                map</Text>
                            <View style={[styles.table, {borderColor: colors.border}]}>
                                {/* Table Header */}
                                <View style={[styles.tableRow, styles.tableHeader, {backgroundColor: colors.surface}]}>
                                    <Text style={[styles.tableHeaderText, {color: colors.secondaryText}]}>#</Text>
                                    <Text style={[styles.tableHeaderText, {color: colors.secondaryText}]}>Lap
                                        Time</Text>
                                    {Array.from({length: numSectors}, (_, i) => (
                                        <Text key={i}
                                              style={[styles.tableHeaderText, {color: colors.secondaryText}]}>S{i + 1}</Text>
                                    ))}
                                </View>

                                {/* Table Rows */}
                                {session.laps.map((lap, idx) => {
                                    const isBestLap = idx === bestLapIndex;

                                    // Ensure lap has all sectors, pad with 0 if missing
                                    const paddedSectorSplits = [...lap.sectorSplitsMs];
                                    while (paddedSectorSplits.length < numSectors) {
                                        paddedSectorSplits.push(0);
                                    }

                                    return (
                                        <TouchableOpacity
                                            key={lap.lapIndex}
                                            onPress={() => setViewingLapIndex(lap.lapIndex)}
                                            activeOpacity={0.7}
                                            style={[styles.tableRow, {backgroundColor: idx % 2 ? colors.background : 'transparent'}]}
                                        >
                                            <Text style={[styles.tableCell, {color: colors.text}]}>{lap.lapIndex}</Text>
                                            <Text style={[
                                                styles.tableCell,
                                                {
                                                    color: isBestLap ? colors.warning : colors.text,
                                                    fontWeight: isBestLap ? '700' : '400',
                                                    backgroundColor: isBestLap ? colors.warning + '22' : 'transparent',
                                                    borderRadius: 4,
                                                    paddingHorizontal: 4,
                                                }
                                            ]}>
                                                {formatLapTime(lap.lapTimeMs)}
                                            </Text>
                                            {paddedSectorSplits.map((sectorTime, sectorIdx) => {
                                                const isBestSector = sectorTime > 0 && sectorTime === bestSectorTimes[sectorIdx];
                                                const isMissing = sectorTime === 0 || sectorTime == null;
                                                return (
                                                    <Text
                                                        key={sectorIdx}
                                                        style={[
                                                            styles.tableCell,
                                                            {
                                                                color: isMissing ? colors.secondaryText : (isBestSector ? colors.warning : colors.text),
                                                                fontWeight: isBestSector ? '700' : '400',
                                                                backgroundColor: isBestSector ? colors.warning + '22' : 'transparent',
                                                                borderRadius: 4,
                                                                paddingHorizontal: 4,
                                                            }
                                                        ]}
                                                    >
                                                        {isMissing ? '--:--' : formatLapTime(sectorTime)}
                                                    </Text>
                                                );
                                            })}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>
            </SafeAreaView>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 100,
        paddingTop: 60,
    },
    backButton: {
        position: 'absolute',
        top: 8,
        left: 8,
        padding: 12,
        zIndex: 10,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    summaryCard: {
        flex: 1,
        minWidth: '45%',
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
    },
    summaryLabel: {
        fontSize: 12,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    optimalLapCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 24,
    },
    optimalLapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    optimalLapLabel: {
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    optimalLapTime: {
        fontSize: 24,
        fontWeight: '700',
    },
    optimalSectors: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    optimalSectorItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    optimalSectorLabel: {
        fontSize: 12,
    },
    optimalSectorTime: {
        fontSize: 16,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    table: {
        borderWidth: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    tableHeader: {
        borderBottomWidth: 1,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    tableHeaderText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
        textAlign: 'center',
    },
    loadingText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
    errorText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
    tapHint: {
        textAlign: 'center',
        marginBottom: 8,
        fontSize: 14,
    },
    swipeHint: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignSelf: 'center',
        marginBottom: 12,
        backgroundColor: 'rgba(150, 150, 150, 0.15)',
    },
    swipeHintText: {
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '500',
        letterSpacing: 0.5,
    },
});

export default SessionDetailScreen;
