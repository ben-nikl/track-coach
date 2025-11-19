import React, {useState} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import MapView, {MapViewProps, Marker, Polyline} from 'react-native-maps';
import {useTheme} from '../ThemeProvider';
import {Track} from '../data/tracks';
import {computePerpendicularSegment} from '../helpers/generatePerpendicularSectors';
import {useLapSession} from './LapSessionContext';

export interface TrackDetail extends Track {
}

interface TrackDetailScreenProps {
    track: TrackDetail;
    onBack: () => void;
    onStartSession?: (track: TrackDetail) => void;
}

const TrackDetailScreen: React.FC<TrackDetailScreenProps> = ({track, onBack, onStartSession}) => {
    const {colors} = useTheme();
    const {
        startSession,
        endSession,
        sessionActive,
        trackData,
        laps,
        selectedLapIndex,
        setSelectedLapIndex,
        getTrajectoryForLap
    } = useLapSession();
    const [showTrajectory, setShowTrajectory] = useState(false);

    const region: MapViewProps['region'] = {
        latitude: track.latitude,
        longitude: track.longitude,
        latitudeDelta: track.latitudeDelta,
        longitudeDelta: track.longitudeDelta,
    };

    const lineWidthM = 8;
    const startLine = computePerpendicularSegment(track.startLine.center, track.startLine.trackP1, track.startLine.trackP2, lineWidthM);
    const finishSource = track.finishLine ?? track.startLine;
    const finishLine = computePerpendicularSegment(finishSource.center, finishSource.trackP1, finishSource.trackP2, lineWidthM);

    const sectorLines = track.sectors.map((sector) => {
        const segment = computePerpendicularSegment(sector.center, sector.trackP1, sector.trackP2, lineWidthM);
        return {id: sector.id, start: segment.start, end: segment.end};
    });

    const isActiveTrack = sessionActive && trackData?.id === track.id;

    // Get trajectory for selected lap
    const trajectoryPoints = selectedLapIndex !== null ? getTrajectoryForLap(selectedLapIndex) : undefined;

    const renderStartFinishLines = () => (
        <>
            <Marker coordinate={startLine.start} title="Start Line">
                <Text style={styles.flagMarker}>🏁</Text>
            </Marker>
            <Marker coordinate={finishLine.end} title="Finish Line">
                <Text style={styles.flagMarker}>🏁</Text>
            </Marker>
            <Polyline coordinates={[startLine.start, startLine.end]} strokeWidth={4} strokeColor={colors.success}/>
            <Polyline coordinates={[finishLine.start, finishLine.end]} strokeWidth={4} strokeColor={colors.warning}/>
        </>
    );

    const handleSessionButtonPress = () => {
        if (isActiveTrack) {
            endSession();
        } else {
            startSession(track);
            onStartSession?.(track);
        }
    };

    return (
        <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={onBack} style={[styles.backButton, {
                    backgroundColor: colors.surface,
                    borderColor: colors.border
                }]}>
                    <Text style={{color: colors.text, fontSize: 16}}>← Back</Text>
                </TouchableOpacity>
                <Text style={[styles.title, {color: colors.text}]} numberOfLines={1}>{track.name}</Text>
            </View>
            <Text style={[styles.subtitle, {color: colors.secondaryText}]}>{track.location}</Text>

            <MapView style={styles.map} region={region} showsUserLocation={isActiveTrack}>
                {renderStartFinishLines()}
                {sectorLines.map(line => (
                    <Polyline
                        key={line.id}
                        coordinates={[line.start, line.end]}
                        strokeWidth={2}
                        strokeColor={colors.accent}
                    />
                ))}
                {showTrajectory && trajectoryPoints && trajectoryPoints.length > 0 && (
                    <Polyline
                        coordinates={trajectoryPoints.map(p => ({latitude: p.latitude, longitude: p.longitude}))}
                        strokeWidth={3}
                        strokeColor={colors.primary}
                        lineDashPattern={[1]}
                    />
                )}
            </MapView>

            {/* Lap selector */}
            {laps.length > 0 && (
                <View style={styles.lapSelectorContainer}>
                    <Text style={[styles.lapSelectorTitle, {color: colors.text}]}>View Lap Trajectory:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lapScroller}>
                        {laps.map((lap, idx) => (
                            <TouchableOpacity
                                key={lap.lapIndex}
                                onPress={() => {
                                    const newIndex = selectedLapIndex === lap.lapIndex ? null : lap.lapIndex;
                                    setSelectedLapIndex(newIndex);
                                    setShowTrajectory(newIndex !== null);
                                }}
                                style={[
                                    styles.lapButton,
                                    {
                                        backgroundColor: selectedLapIndex === lap.lapIndex ? colors.primary : colors.surface,
                                        borderColor: colors.border
                                    }
                                ]}
                            >
                                <Text style={{
                                    color: selectedLapIndex === lap.lapIndex ? colors.white : colors.text,
                                    fontSize: 12,
                                    fontWeight: '600'
                                }}>
                                    Lap {lap.lapIndex}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <TouchableOpacity
                style={[styles.startSessionButton, {backgroundColor: isActiveTrack ? colors.danger : colors.primary}]}
                activeOpacity={0.85}
                onPress={handleSessionButtonPress}
            >
                <Text style={styles.startSessionText}>
                    {isActiveTrack ? 'End Session' : 'Start Session'}
                </Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {flex: 1, width: '100%'},
    headerRow: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16},
    backButton: {paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, marginRight: 12},
    title: {fontSize: 22, fontWeight: '700', flex: 1},
    subtitle: {fontSize: 14, paddingHorizontal: 16, marginTop: 4, marginBottom: 16},
    map: {flex: 1, marginHorizontal: 16, borderRadius: 16},
    meta: {padding: 16},
    metaLabel: {fontSize: 13, fontWeight: '600', marginBottom: 4, letterSpacing: 0.3},
    metaValue: {fontSize: 13, fontVariant: ['tabular-nums']},
    flagMarker: {fontSize: 24},
    startSessionButton: {
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 24,
        borderRadius: 16,
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    startSessionText: {fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 0.5},
    lapSelectorContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    lapSelectorTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    lapScroller: {
        flexDirection: 'row',
    },
    lapButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        marginRight: 8,
        borderWidth: 1,
    },
});

export default TrackDetailScreen;
