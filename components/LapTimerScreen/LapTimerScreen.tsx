import React, {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../ThemeProvider';
import LapPanel from './LapPanel';
import LapTimeDisplay from './LapTimeDisplay';
import SectorBox from './SectorBox';
import {formatLapTime} from './format';
import {Track} from '../../data/tracks';
import {computePerpendicularSegment} from '../../helpers/generatePerpendicularSectors';
import * as Location from 'expo-location';
import {intersectionParamT, segmentsIntersect} from '../../helpers/geo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useLapSession} from '../LapSessionContext';

export interface LapTimerScreenProps {
    trackData: Track | null;
    trackName?: string; // backward compatibility
    onBack?: () => void;
    onMenu?: () => void;
}

interface SectorTimingState {
    id: string;
    timeMs?: number;
}

interface ToastMsg {
    id: string;
    text: string;
}

const LINE_HALF_WIDTH_M = 12; // width for perpendicular timing lines
const LOCATION_INTERVAL_MS = 250; // typical update cadence

const LapTimerScreen: React.FC<LapTimerScreenProps> = ({trackData, onBack, onMenu}) => {
    const {colors} = useTheme();
    const insets = useSafeAreaInsets();
    const {width, height} = useWindowDimensions();
    const landscape = width > height;

    // Timing state
    const [lapTimes, setLapTimes] = useState<number[]>([]); // completed laps
    const [currentLapStartMs, setCurrentLapStartMs] = useState<number | null>(null);
    const [lastLapMs, setLastLapMs] = useState<number | null>(null);
    const [bestLapMs, setBestLapMs] = useState<number | null>(null);
    const [sectorsTiming, setSectorsTiming] = useState<SectorTimingState[]>([]); // current lap sector times

    // Location tracking refs
    const prevLocationRef = useRef<Location.LocationObject | null>(null);
    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const [permissionError, setPermissionError] = useState<string | null>(null);

    // Toast messages state
    const [toastMessages, setToastMessages] = useState<ToastMsg[]>([]);
    const prevSectorCrossMsRef = useRef<number | null>(null);

    // Lap session logging
    const {logStart, logSector, logFinish} = useLapSession();

    // Precompute timing lines when track changes
    const startFinishSegments = React.useMemo(() => {
        if (!trackData) return null;
        const s = computePerpendicularSegment(trackData.startLine.center, trackData.startLine.trackP1, trackData.startLine.trackP2, LINE_HALF_WIDTH_M);
        const f = computePerpendicularSegment(trackData.finishLine.center, trackData.finishLine.trackP1, trackData.finishLine.trackP2, LINE_HALF_WIDTH_M);
        return {start: s, finish: f};
    }, [trackData]);

    const sectorSegments = React.useMemo(() => {
        if (!trackData) return [];
        return trackData.sectors.map(sec => ({
            id: sec.id,
            seg: computePerpendicularSegment(sec.center, sec.trackP1, sec.trackP2, LINE_HALF_WIDTH_M)
        }));
    }, [trackData]);

    const sectorBoundaryLines = React.useMemo(() => {
        if (!trackData) return [];
        return trackData.sectors.filter(sec => sec.id !== trackData.startLine.id && sec.id !== trackData.finishLine.id);
    }, [trackData]);

    // Reset timing when track changes
    useEffect(() => {
        setLapTimes([]);
        setCurrentLapStartMs(null);
        setLastLapMs(null);
        setBestLapMs(null);
        setSectorsTiming([]);
    }, [trackData]);

    // Load persisted laps when track changes
    useEffect(() => {
        async function load() {
            if (!trackData) return;
            try {
                const raw = await AsyncStorage.getItem(`laps:${trackData.id}`);
                if (raw) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) setLapTimes(arr.filter(n => typeof n === 'number'));
                }
            } catch {
            }
        }

        load();
    }, [trackData]);

    const addToast = (text: string) => {
        const id = Math.random().toString(36).slice(2);
        setToastMessages(msgs => [...msgs, {id, text}]);
        setTimeout(() => setToastMessages(msgs => msgs.filter(m => m.id !== id)), 2200);
    };

    // Helper to mark sector crossing
    const markSectorCrossing = (sectorId: string, crossingTimeMs: number) => {
        setSectorsTiming(prev => {
            if (prev.some(s => s.id === sectorId)) return prev;
            const base = prevSectorCrossMsRef.current ?? currentLapStartMs ?? crossingTimeMs;
            const split = crossingTimeMs - base;
            const lapElapsed = currentLapStartMs != null ? crossingTimeMs - currentLapStartMs : split;
            prevSectorCrossMsRef.current = crossingTimeMs;
            addToast(`SECTOR split #${prev.length + 1}: ${formatLapTime(split)}`);
            if (currentLapStartMs != null) {
                logSector(crossingTimeMs, lapElapsed, split, prev.length + 1);
            }
            return [...prev, {id: sectorId, timeMs: split}];
        });
    };

    // Start a new lap
    const startLap = (startTimeMs: number) => {
        setCurrentLapStartMs(startTimeMs);
        setSectorsTiming([]);
        prevSectorCrossMsRef.current = startTimeMs;
        addToast('Lap started');
        logStart(startTimeMs);
    };

    // Finish current lap
    const finishLap = (finishTimeMs: number) => {
        if (currentLapStartMs == null) return;
        const lastBoundaryTimeBase = prevSectorCrossMsRef.current ?? currentLapStartMs;
        const finalSplit = finishTimeMs - lastBoundaryTimeBase;
        const lapDuration = finishTimeMs - currentLapStartMs;
        // Build sector splits array (existing splits + final)
        const sectorSplitsMs = [...sectorsTiming.map(s => s.timeMs || 0), finalSplit];
        // Log final sector and lap BEFORE state reset
        const lapElapsed = finishTimeMs - currentLapStartMs;
        addToast(`Lap finished: ${formatLapTime(lapDuration)}`);
        logFinish(finishTimeMs, lapElapsed, lapDuration, finalSplit, sectorSplitsMs);
        setSectorsTiming(prev => {
            const expectedSplitsTotal = sectorBoundaryLines.length + 1;
            if (prev.length < expectedSplitsTotal) {
                addToast(`SECTOR split #${prev.length + 1}: ${formatLapTime(finalSplit)}`);
                return [...prev, {id: 'final', timeMs: finalSplit}];
            }
            return prev;
        });
        setLapTimes(prev => {
            const updated = [...prev, lapDuration];
            if (trackData) {
                AsyncStorage.setItem(`laps:${trackData.id}`, JSON.stringify(updated)).catch(() => {
                });
            }
            return updated;
        });
        setLastLapMs(lapDuration);
        setBestLapMs(prev => (prev == null || lapDuration < prev ? lapDuration : prev));
        // Start new lap
        startLap(finishTimeMs);
        prevSectorCrossMsRef.current = finishTimeMs;
    };

    // Subscribe to location updates
    useEffect(() => {
        let cancelled = false;
        const lastStartCrossRef = {value: 0}; // simple debounce
        const lastFinishCrossRef = {value: 0};

        async function init() {
            if (!trackData) return;
            const {status} = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setPermissionError('Location permission denied');
                return;
            }
            locationSubRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: LOCATION_INTERVAL_MS,
                    distanceInterval: 0
                },
                loc => {
                    if (cancelled) return;
                    const prev = prevLocationRef.current;
                    prevLocationRef.current = loc;
                    if (!prev || !startFinishSegments) return;
                    const p1 = {latitude: prev.coords.latitude, longitude: prev.coords.longitude};
                    const p2 = {latitude: loc.coords.latitude, longitude: loc.coords.longitude};
                    const tPrev = prev.timestamp;
                    const tCur = loc.timestamp;

                    if (currentLapStartMs == null) {
                        const {start} = startFinishSegments;
                        if (segmentsIntersect(p1, p2, start.start, start.end)) {
                            const tParam = intersectionParamT(p1, p2, start.start, start.end) ?? 0;
                            const crossingMs = Math.round(tPrev + tParam * (tCur - tPrev));
                            if (crossingMs - lastStartCrossRef.value > 500) {
                                lastStartCrossRef.value = crossingMs;
                                startLap(crossingMs);
                            }
                        }
                        return;
                    }

                    const {finish} = startFinishSegments;
                    const identicalStartFinish = trackData.startLine.id === trackData.finishLine.id;
                    if (segmentsIntersect(p1, p2, finish.start, finish.end)) {
                        const tParam = intersectionParamT(p1, p2, finish.start, finish.end) ?? 0;
                        const crossingMs = Math.round(tPrev + tParam * (tCur - tPrev));
                        // If identical start/finish and lap just begun, require minimum elapsed to treat as finish
                        if (identicalStartFinish && currentLapStartMs != null && crossingMs - currentLapStartMs < 1000) {
                            // ignore very fast re-cross within 1s to avoid double-start
                        } else if (crossingMs - lastFinishCrossRef.value > 500) {
                            lastFinishCrossRef.value = crossingMs;
                            finishLap(crossingMs);
                        }
                    } else {
                        sectorSegments.forEach(sec => {
                            if (sec.id === trackData.startLine.id || sec.id === trackData.finishLine.id) return;
                            if (segmentsIntersect(p1, p2, sec.seg.start, sec.seg.end)) {
                                const tParam = intersectionParamT(p1, p2, sec.seg.start, sec.seg.end) ?? 0;
                                const crossingMs = Math.round(tPrev + tParam * (tCur - tPrev));
                                markSectorCrossing(sec.id, crossingMs);
                            }
                        });
                    }
                }
            );
        }

        init();
        return () => {
            cancelled = true;
            locationSubRef.current?.remove();
            locationSubRef.current = null;
        };
    }, [trackData, startFinishSegments, sectorSegments, currentLapStartMs]);

    // Derived values for UI
    const currentLapElapsedMs = currentLapStartMs != null ? Date.now() - currentLapStartMs : null;
    const lapNumber = lapTimes.length + (currentLapStartMs != null ? 1 : 0);

    // Build sector boxes list according to track.sectors order
    const sectorBoxes = React.useMemo(() => {
        const splitsExpected = sectorBoundaryLines.length + 1;
        const boxes = [] as { index: number; time?: number }[];
        for (let i = 0; i < splitsExpected; i++) {
            boxes.push({index: i + 1, time: sectorsTiming[i]?.timeMs});
        }
        return boxes;
    }, [sectorsTiming, sectorBoundaryLines]);

    // UI Panels content
    const ghostLapMs = bestLapMs ?? undefined;

    if (!trackData) {
        return (
            <SafeAreaView
                style={[styles.portraitRoot, {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16}]}><Text
                style={{color: colors.text}}>No track selected.</Text><Pressable onPress={onBack}
                                                                                 style={{marginTop: 24}}><Text
                style={{color: colors.primary}}>Back to tracks</Text></Pressable></SafeAreaView>
        );
    }

    // Helper render functions to keep JSX clean
    const ToastOverlay = () => (
        <View pointerEvents="none" style={styles.toastContainer}>
            {toastMessages.map(t => (
                <View key={t.id} style={[styles.toast, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                    <Text style={{color: colors.text, fontSize: 12, fontWeight: '600'}}>{t.text}</Text>
                </View>
            ))}
        </View>
    );

    const renderLandscape = () => (
        <SafeAreaView
            style={[styles.containerLandscape, {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16}]}>
            <ToastOverlay/>
            <View style={styles.headerRow}>
                <Pressable accessibilityRole="button" onPress={onBack} style={styles.headerBtn}><Text
                    style={[styles.headerBtnText, {color: colors.text}]}>◄</Text></Pressable>
                <Text style={[styles.trackTitle, {color: colors.text}]} numberOfLines={1}>{trackData!.name}</Text>
                <Pressable accessibilityRole="button" onPress={onMenu} style={styles.headerBtn}><Text
                    style={[styles.headerBtnText, {color: colors.text}]}>⋮</Text></Pressable>
            </View>
            <View style={styles.landscapeRow}>
                <View style={styles.landscapeLeft}>
                    <LapTimeDisplay lastLapMs={lastLapMs ?? undefined} lastLapDeltaMs={undefined}
                                    lapNumber={lapNumber}/>
                    <View style={styles.spacer}/>
                    <View style={styles.timersContainer}>
                        <LapPanel title="Ghost Lap (PB)" center>
                            <Text
                                style={[styles.panelMainTime, {color: colors.text}]}>{formatLapTime(ghostLapMs ?? NaN)}</Text>
                        </LapPanel>
                        <LapPanel title="Best Lap" style={styles.bestLapLandscape}>
                            <Text
                                style={[styles.panelMainTime, {color: colors.secondaryText}]}>{formatLapTime(bestLapMs ?? NaN)}</Text>
                        </LapPanel>
                    </View>
                </View>
                <View style={styles.landscapeRight}>
                    <View style={styles.sectorsGrid}>
                        {sectorBoxes.map(s => (<SectorBox key={s.index} {...s} />))}
                    </View>
                </View>
            </View>
            {currentLapElapsedMs != null && (
                <Text style={{color: colors.accent, textAlign: 'center', marginTop: 8}}>
                    Current Lap: {formatLapTime(currentLapElapsedMs)}
                </Text>
            )}
            {permissionError && (
                <Text style={{color: colors.danger, textAlign: 'center', marginTop: 4}}>{permissionError}</Text>
            )}
        </SafeAreaView>
    );

    const renderPortrait = () => (
        <SafeAreaView style={[styles.portraitRoot, {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16}]}>
            <View style={styles.headerRow}>
                <Pressable accessibilityRole="button" onPress={onBack} style={styles.headerBtn}><Text
                    style={[styles.headerBtnText, {color: colors.text}]}>◄</Text></Pressable>
                <Text style={[styles.trackTitle, {color: colors.text}]} numberOfLines={1}>{trackData!.name}</Text>
                <Pressable accessibilityRole="button" onPress={onMenu} style={styles.headerBtn}><Text
                    style={[styles.headerBtnText, {color: colors.text}]}>⋮</Text></Pressable>
            </View>
            <LapPanel title="Ghost Lap (PB)" style={[styles.ghostPortrait, styles.sectionStretch]}>
                <Text style={[styles.panelMainTime, {color: colors.text}]}>{formatLapTime(ghostLapMs ?? NaN)}</Text>
            </LapPanel>
            <View style={[styles.lastLapPortrait, styles.sectionStretch]}>
                <LapTimeDisplay lastLapMs={lastLapMs ?? undefined} lastLapDeltaMs={undefined} lapNumber={lapNumber}/>
                {currentLapElapsedMs != null && (
                    <Text style={{color: colors.accent, marginTop: 8}}>
                        Current: {formatLapTime(currentLapElapsedMs)}
                    </Text>
                )}
            </View>
            <View style={styles.sectorsGridPortrait}>
                {sectorBoxes.map(s => (<SectorBox key={s.index} {...s} />))}
            </View>
            <LapPanel title="Best Lap" style={[styles.bestLapPortrait, styles.sectionStretch]}>
                <Text
                    style={[styles.panelMainTime, {color: colors.secondaryText}]}>{formatLapTime(bestLapMs ?? NaN)}</Text>
            </LapPanel>
            {permissionError && (
                <Text style={{color: colors.danger, textAlign: 'center', marginTop: 4}}>{permissionError}</Text>
            )}
        </SafeAreaView>
    );

    return landscape ? renderLandscape() : renderPortrait();
};

const styles = StyleSheet.create({
    portraitRoot: {flex: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center'},
    sectionStretch: {alignSelf: 'stretch'},
    // Landscape container
    containerLandscape: {flex: 1, paddingHorizontal: 18},
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        alignSelf: 'stretch'
    },
    headerBtn: {padding: 6},
    headerBtnText: {fontSize: 18, fontWeight: '600'},
    trackTitle: {fontSize: 16, fontWeight: '700'},
    spacer: {height: 16},
    panelMainTime: {fontSize: 32, fontWeight: '700', textAlign: 'center'},
    ghostPortrait: {
        marginBottom: 32,
        flexDirection: 'column',
        alignContent: 'center',
        justifyContent: 'center',
        alignItems: 'center'
    },
    lastLapPortrait: {marginBottom: 32, alignItems: 'center'},
    lapCounter: {marginTop: 12, fontSize: 14, fontWeight: '600', textAlign: 'center'},
    sectorsGridPortrait: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 8,
        rowGap: 8,
        marginBottom: 32,
        justifyContent: 'space-between'
    },
    bestLapPortrait: {marginBottom: 64, alignItems: 'center'},
    sectorsGrid: {flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8, justifyContent: 'space-between'},
    landscapeRow: {flex: 1, flexDirection: 'row', columnGap: 32},
    landscapeLeft: {flex: 1, justifyContent: 'space-between'},
    landscapeRight: {flex: 1, justifyContent: 'flex-start'},
    bestLapLandscape: {alignItems: 'center'},
    timersContainer: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16},
    toastContainer: {position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center', zIndex: 20},
    toast: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 14,
        marginBottom: 6,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3
    },
});

export default LapTimerScreen;
