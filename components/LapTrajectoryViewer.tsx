/**
 * Lap Trajectory Viewer
 *
 * Full-screen view for displaying a single lap's trajectory on track map
 * with swipe navigation between laps
 */

import React, {useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import MapView, {MapViewProps, Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
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
    const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');

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

    const cycleMapType = () => {
        setMapType(prev => {
            if (prev === 'standard') return 'satellite';
            if (prev === 'satellite') return 'hybrid';
            return 'standard';
        });
    };

    const getMapTypeLabel = () => {
        switch (mapType) {
            case 'standard':
                return '🗺️';
            case 'satellite':
                return '🛰️';
            case 'hybrid':
                return '🌍';
            default:
                return '🗺️';
        }
    };

    return (
        <View style={[styles.container, {backgroundColor: colors.background}]}>
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
                <TouchableOpacity onPress={cycleMapType} style={styles.mapTypeButton}>
                    <Text style={{fontSize: 24}}>{getMapTypeLabel()}</Text>
                </TouchableOpacity>
            </View>

            {/* Map */}
            <MapView
                style={styles.map}
                region={mapRegion}
                mapType={mapType}
                provider={PROVIDER_GOOGLE}
            >
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
                    <>
                        {/* Render trajectory as colored segments based on driving state */}
                        {currentLap.trajectoryPoints.map((point, idx) => {
                            if (idx === 0 || !currentLap.trajectoryPoints) return null; // Skip first point

                            const prevPoint = currentLap.trajectoryPoints[idx - 1];
                            const drivingState = point.drivingState || 'unknown';

                            // Determine color based on driving state
                            let strokeColor: string;
                            switch (drivingState) {
                                case 'braking':
                                    strokeColor = '#FF0000'; // Red
                                    break;
                                case 'accelerating':
                                    strokeColor = '#00FF00'; // Green
                                    break;
                                case 'coasting':
                                    strokeColor = '#0080FF'; // Blue
                                    break;
                                default:
                                    strokeColor = isBestLap ? colors.warning : colors.primary;
                            }

                            return (
                                <Polyline
                                    key={`segment-${idx}`}
                                    coordinates={[
                                        {latitude: prevPoint.latitude, longitude: prevPoint.longitude},
                                        {latitude: point.latitude, longitude: point.longitude}
                                    ]}
                                    strokeWidth={5}
                                    strokeColor={strokeColor}
                                />
                            );
                        })}
                    </>
                )}
            </MapView>

            {/* Lap Info & Navigation */}
            <View style={[styles.footer, {backgroundColor: colors.surface, borderTopColor: colors.border}]}>
                {/* Color Legend */}
                <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendColor, {backgroundColor: '#FF0000'}]}/>
                        <Text style={[styles.legendText, {color: colors.secondaryText}]}>Brzdění</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendColor, {backgroundColor: '#00FF00'}]}/>
                        <Text style={[styles.legendText, {color: colors.secondaryText}]}>Akcelerace</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendColor, {backgroundColor: '#0080FF'}]}/>
                        <Text style={[styles.legendText, {color: colors.secondaryText}]}>Coasting</Text>
                    </View>
                </View>

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
    mapTypeButton: {
        minWidth: 60,
        alignItems: 'flex-end',
        padding: 8,
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
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    legendColor: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 8,
    },
    legendText: {
        fontSize: 14,
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
