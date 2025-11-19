/**
 * Lap Trajectory Viewer
 *
 * Full-screen view for displaying a single lap's trajectory on track map
 * with swipe navigation between laps
 */

import React, {useRef, useState} from 'react';
import {GestureResponderEvent, PanResponder, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import MapView, {MapViewProps, Marker, Polyline} from 'react-native-maps';
import {useTheme} from '../ThemeProvider';
import {LapRecord} from '../helpers/lapSessionTypes';
import {formatLapTime} from './LapTimerScreen/format';
import {computePerpendicularSegment} from '../helpers/generatePerpendicularSectors';

interface LapTrajectoryViewerProps {
    trackName: string;
    trackLocation: string;
    mapRegion: MapViewProps['region'];
    startLine: {
        center: { latitude: number; longitude: number };
        trackP1: { latitude: number; longitude: number };
        trackP2: { latitude: number; longitude: number };
    };
    finishLine?: {
        center: { latitude: number; longitude: number };
        trackP1: { latitude: number; longitude: number };
        trackP2: { latitude: number; longitude: number };
    };
    sectors: Array<{
        id: string;
        center: { latitude: number; longitude: number };
        trackP1: { latitude: number; longitude: number };
        trackP2: { latitude: number; longitude: number };
    }>;
    laps: LapRecord[];
    initialLapIndex: number;
    bestLapTimeMs?: number;
    onBack: () => void;
}

const LapTrajectoryViewer: React.FC<LapTrajectoryViewerProps> = ({
                                                                     trackName,
                                                                     trackLocation,
                                                                     mapRegion,
                                                                     startLine,
                                                                     finishLine,
                                                                     sectors,
                                                                     laps,
                                                                     initialLapIndex,
                                                                     bestLapTimeMs,
                                                                     onBack
                                                                 }) => {
    const {colors} = useTheme();
    const [currentLapIndex, setCurrentLapIndex] = useState(initialLapIndex);
    const [swipeStartY, setSwipeStartY] = useState(0);

    const currentLap = laps.find(lap => lap.lapIndex === currentLapIndex);
    const currentLapArrayIndex = laps.findIndex(lap => lap.lapIndex === currentLapIndex);
    const isBestLap = currentLap?.lapTimeMs === bestLapTimeMs;

    const lineWidthM = 8;
    const startLineSegment = computePerpendicularSegment(startLine.center, startLine.trackP1, startLine.trackP2, lineWidthM);
    const finishSource = finishLine ?? startLine;
    const finishLineSegment = computePerpendicularSegment(finishSource.center, finishSource.trackP1, finishSource.trackP2, lineWidthM);

    const sectorLines = sectors.map((sector) => {
        const segment = computePerpendicularSegment(sector.center, sector.trackP1, sector.trackP2, lineWidthM);
        return {id: sector.id, start: segment.start, end: segment.end};
    });

    // Swipe gesture handler
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only trigger if vertical movement is significant
                return Math.abs(gestureState.dy) > 10;
            },
            onPanResponderGrant: (evt: GestureResponderEvent) => {
                setSwipeStartY(evt.nativeEvent.pageY);
            },
            onPanResponderRelease: (evt: GestureResponderEvent) => {
                const swipeEndY = evt.nativeEvent.pageY;
                const swipeDistance = swipeStartY - swipeEndY;
                const swipeThreshold = 50;

                if (swipeDistance > swipeThreshold) {
                    // Swipe up - next lap (higher lap number)
                    if (currentLapArrayIndex < laps.length - 1) {
                        setCurrentLapIndex(laps[currentLapArrayIndex + 1].lapIndex);
                    }
                } else if (swipeDistance < -swipeThreshold) {
                    // Swipe down - previous lap (lower lap number)
                    if (currentLapArrayIndex > 0) {
                        setCurrentLapIndex(laps[currentLapArrayIndex - 1].lapIndex);
                    }
                }
            },
        })
    ).current;

    const goToPreviousLap = () => {
        if (currentLapArrayIndex > 0) {
            setCurrentLapIndex(laps[currentLapArrayIndex - 1].lapIndex);
        }
    };

    const goToNextLap = () => {
        if (currentLapArrayIndex < laps.length - 1) {
            setCurrentLapIndex(laps[currentLapArrayIndex + 1].lapIndex);
        }
    };

    return (
        <View style={[styles.container, {backgroundColor: colors.background}]} {...panResponder.panHandlers}>
            {/* Header */}
            <View style={[styles.header, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={{color: colors.accent, fontSize: 16, fontWeight: '600'}}>← Back</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.trackName, {color: colors.text}]} numberOfLines={1}>{trackName}</Text>
                    <Text style={[styles.trackLocation, {color: colors.secondaryText}]}
                          numberOfLines={1}>{trackLocation}</Text>
                </View>
                <View style={styles.backButton}/>
            </View>

            {/* Map */}
            <MapView style={styles.map} region={mapRegion}>
                {/* Start/Finish Lines */}
                <Marker coordinate={startLineSegment.start} title="Start Line">
                    <Text style={styles.flagMarker}>🏁</Text>
                </Marker>
                <Marker coordinate={finishLineSegment.end} title="Finish Line">
                    <Text style={styles.flagMarker}>🏁</Text>
                </Marker>
                <Polyline
                    coordinates={[startLineSegment.start, startLineSegment.end]}
                    strokeWidth={4}
                    strokeColor={colors.success}
                />
                <Polyline
                    coordinates={[finishLineSegment.start, finishLineSegment.end]}
                    strokeWidth={4}
                    strokeColor={colors.warning}
                />

                {/* Sector Lines */}
                {sectorLines.map(line => (
                    <Polyline
                        key={line.id}
                        coordinates={[line.start, line.end]}
                        strokeWidth={2}
                        strokeColor={colors.accent}
                    />
                ))}

                {/* Trajectory */}
                {currentLap?.trajectoryPoints && currentLap.trajectoryPoints.length > 0 && (
                    <Polyline
                        coordinates={currentLap.trajectoryPoints.map(p => ({
                            latitude: p.latitude,
                            longitude: p.longitude
                        }))}
                        strokeWidth={4}
                        strokeColor={isBestLap ? colors.warning : colors.primary}
                    />
                )}
            </MapView>

            {/* Lap Info & Navigation */}
            <View style={[styles.footer, {backgroundColor: colors.surface, borderTopColor: colors.border}]}>
                {/* Navigation arrows */}
                <View style={styles.navigationRow}>
                    <TouchableOpacity
                        onPress={goToPreviousLap}
                        disabled={currentLapArrayIndex === 0}
                        style={[styles.navButton, {opacity: currentLapArrayIndex === 0 ? 0.3 : 1}]}
                    >
                        <Text style={{color: colors.text, fontSize: 24}}>▲</Text>
                    </TouchableOpacity>

                    <View style={styles.lapInfo}>
                        <Text style={[styles.lapNumberText, {color: colors.secondaryText}]}>
                            Lap {currentLapIndex}
                        </Text>
                        {currentLap && (
                            <Text style={[styles.lapTimeText, {color: isBestLap ? colors.warning : colors.text}]}>
                                {formatLapTime(currentLap.lapTimeMs)}
                                {isBestLap && ' 🏆'}
                            </Text>
                        )}
                        {currentLap?.sectorSplitsMs && (
                            <View style={styles.sectorTimesRow}>
                                {currentLap.sectorSplitsMs.map((time, idx) => (
                                    <Text key={idx} style={[styles.sectorTime, {color: colors.secondaryText}]}>
                                        S{idx + 1}: {formatLapTime(time)}
                                    </Text>
                                ))}
                            </View>
                        )}
                        <Text style={[styles.swipeHint, {color: colors.secondaryText}]}>
                            Swipe up/down to navigate laps
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={goToNextLap}
                        disabled={currentLapArrayIndex === laps.length - 1}
                        style={[styles.navButton, {opacity: currentLapArrayIndex === laps.length - 1 ? 0.3 : 1}]}
                    >
                        <Text style={{color: colors.text, fontSize: 24}}>▼</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: 52,
        borderBottomWidth: 1,
    },
    backButton: {
        minWidth: 60,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    trackName: {
        fontSize: 18,
        fontWeight: '700',
    },
    trackLocation: {
        fontSize: 12,
        marginTop: 2,
    },
    map: {
        flex: 1,
    },
    flagMarker: {
        fontSize: 24,
    },
    footer: {
        borderTopWidth: 1,
        paddingVertical: 16,
        paddingBottom: 32,
    },
    navigationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    navButton: {
        padding: 8,
        minWidth: 50,
        alignItems: 'center',
    },
    lapInfo: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    lapNumberText: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    lapTimeText: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 8,
    },
    sectorTimesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 8,
    },
    sectorTime: {
        fontSize: 12,
    },
    swipeHint: {
        fontSize: 11,
        fontStyle: 'italic',
    },
});

export default LapTrajectoryViewer;
