import React, {useEffect, useRef, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../ThemeProvider';
import LapPanel from './LapPanel';
import LapTimeDisplay from './LapTimeDisplay';
import SectorBox from './SectorBox';
import {formatLapTime} from './format';
import {Track} from '../../data/tracks';
import {computePerpendicularSegment} from '../../helpers/generatePerpendicularSectors';
import * as Location from 'expo-location';
import {distancePointToSegmentMeters, intersectionParamT, segmentsIntersect} from '../../helpers/geo';
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
const REQUIRED_ACCURACY_M = 15; // ignore fixes with worse accuracy for timing precision
// Debounce & hysteresis constants
const START_DEBOUNCE_MS = 1200; // minimum ms between start line crossings
const SEGMENT_DEBOUNCE_MS = 800; // minimum ms between internal segment crossings
const FINISH_DEBOUNCE_MS = 800; // minimum ms between finish line crossings
const LINE_REARM_DISTANCE_M = 6; // must move away this far before the line re-arms for another crossing

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
    const [nowMs, setNowMs] = useState<number>(Date.now()); // live ticker for current lap

    // Location tracking refs
    const prevLocationRef = useRef<Location.LocationObject | null>(null);
    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    // Added missing refs for line arming & sector timing debounce
    const startArmedRef = useRef<boolean>(true); // re-armed when distance >= LINE_REARM_DISTANCE_M
    const finishArmedRef = useRef<boolean>(true); // mirrors start when identical start/finish
    const segmentArmedRef = useRef<Record<string, boolean>>({}); // per internal sector boundary line
    const lastSectorCrossTimesRef = useRef<Record<string, number>>({}); // last crossing timestamp per sector for debounce

    // Toast messages state
    const [toastMessages, setToastMessages] = useState<ToastMsg[]>([]);
    const prevSectorCrossMsRef = useRef<number | null>(null);
    // Removed distanceToStartM; now tracking all line distances (start + internal sector lines + finish)
    const [lineDistances, setLineDistances] = useState<{ id: string; label: string; distance: number }[]>([]);

    // Lap session logging
    const {logStart, logSector, logFinish} = useLapSession();
    const defer = (fn: () => void) => setTimeout(fn, 0);

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
        // sectors now only contains internal boundary lines (may be empty)
        return trackData.sectors;
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
                defer(() => logSector(crossingTimeMs, lapElapsed, split, prev.length + 1));
            }
            return [...prev, {id: sectorId, timeMs: split}];
        });
    };

    // Start a new lap
    const startLap = (startTimeMs: number) => {
        setCurrentLapStartMs(startTimeMs);
        setSectorsTiming([]);
        prevSectorCrossMsRef.current = startTimeMs;
        setNowMs(Date.now());
        addToast('Lap started');
        defer(() => logStart(startTimeMs));
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
        defer(() => logFinish(finishTimeMs, lapElapsed, lapDuration, finalSplit, sectorSplitsMs));
        setSectorsTiming(prev => {
            const expectedSplitsTotal = sectorBoundaryLines.length + 1; // internal boundaries + final sector to finish
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
        // Start new lap only if start and finish are the same line; otherwise wait for next start crossing
        const identicalStartFinish = trackData && trackData.startLine.id === trackData.finishLine.id;
        if (identicalStartFinish) {
            startLap(finishTimeMs);
            prevSectorCrossMsRef.current = finishTimeMs;
        } else {
            setCurrentLapStartMs(null);
            setSectorsTiming([]);
            prevSectorCrossMsRef.current = null;
        }
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
            // iOS: hint to OS about navigation usage (ignore if unsupported)
            if (Platform.OS === 'ios' && (Location as any).setActivityTypeAsync) {
                try {
                    await (Location as any).setActivityTypeAsync('automotiveNavigation');
                } catch {
                }
            }
            locationSubRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 0,
                    distanceInterval: 0,
                },
                loc => {
                    if (cancelled) return;
                    if (loc.coords.accuracy != null && loc.coords.accuracy > REQUIRED_ACCURACY_M) return;
                    const prev = prevLocationRef.current;
                    prevLocationRef.current = loc;
                    if (!prev || !startFinishSegments) return;
                    const {start, finish} = startFinishSegments;
                    const p1 = {latitude: prev.coords.latitude, longitude: prev.coords.longitude};
                    const p2 = {latitude: loc.coords.latitude, longitude: loc.coords.longitude};
                    const tPrev = prev.timestamp;
                    const tCur = loc.timestamp;

                    // Distances to timing lines
                    try {
                        const sameLine = Math.abs(start.start.latitude - finish.start.latitude) < 1e-9 &&
                            Math.abs(start.start.longitude - finish.start.longitude) < 1e-9 &&
                            Math.abs(start.end.latitude - finish.end.latitude) < 1e-9 &&
                            Math.abs(start.end.longitude - finish.end.longitude) < 1e-9;
                        const distances: { id: string; label: string; distance: number }[] = [];
                        const startDist = distancePointToSegmentMeters(p2, start.start, start.end);
                        // Hysteresis re-arm for start line
                        if (!startArmedRef.current && startDist >= LINE_REARM_DISTANCE_M) startArmedRef.current = true;
                        if (sameLine) {
                            distances.push({id: trackData.startLine.id, label: 'START/FINISH', distance: startDist});
                        } else {
                            distances.push({id: trackData.startLine.id, label: 'START', distance: startDist});
                        }
                        sectorSegments.forEach(sec => {
                            const d = distancePointToSegmentMeters(p2, sec.seg.start, sec.seg.end);
                            // Re-arm hysteresis for segment
                            if (!segmentArmedRef.current[sec.id] && d >= LINE_REARM_DISTANCE_M) segmentArmedRef.current[sec.id] = true;
                            distances.push({id: sec.id, label: sec.id.toUpperCase(), distance: d});
                        });
                        if (!sameLine) {
                            const finishDist = distancePointToSegmentMeters(p2, finish.start, finish.end);
                            if (!finishArmedRef.current && finishDist >= LINE_REARM_DISTANCE_M) finishArmedRef.current = true;
                            distances.push({id: trackData.finishLine.id, label: 'FINISH', distance: finishDist});
                        } else {
                            // identical line: finishArmedRef mirrors startArmedRef
                            finishArmedRef.current = startArmedRef.current;
                        }
                        setLineDistances(distances);
                    } catch {
                    }

                    if (currentLapStartMs == null) {
                        // Attempt start crossing only if armed & debounce window passed
                        if (startArmedRef.current && segmentsIntersect(p1, p2, start.start, start.end)) {
                            const tParam = intersectionParamT(p1, p2, start.start, start.end) ?? 0;
                            const crossingMs = Math.round(tPrev + tParam * (tCur - tPrev));
                            if (crossingMs - lastStartCrossRef.value > START_DEBOUNCE_MS) {
                                lastStartCrossRef.value = crossingMs;
                                startArmedRef.current = false; // disarm until moved away
                                startLap(crossingMs);
                            }
                        }
                        return;
                    }

                    // Finish line crossing
                    if (finishArmedRef.current && segmentsIntersect(p1, p2, finish.start, finish.end)) {
                        const tParam = intersectionParamT(p1, p2, finish.start, finish.end) ?? 0;
                        const crossingMs = Math.round(tPrev + tParam * (tCur - tPrev));
                        if (crossingMs - lastFinishCrossRef.value > FINISH_DEBOUNCE_MS) {
                            lastFinishCrossRef.value = crossingMs;
                            finishArmedRef.current = false;
                            finishLap(crossingMs);
                        }
                    } else {
                        // Segment crossings
                        sectorSegments.forEach(sec => {
                            if (!segmentArmedRef.current[sec.id]) return; // not re-armed yet
                            if (segmentsIntersect(p1, p2, sec.seg.start, sec.seg.end)) {
                                const tParam = intersectionParamT(p1, p2, sec.seg.start, sec.seg.end) ?? 0;
                                const crossingMs = Math.round(tPrev + tParam * (tCur - tPrev));
                                const last = lastSectorCrossTimesRef.current[sec.id] || 0;
                                if (crossingMs - last > SEGMENT_DEBOUNCE_MS) {
                                    lastSectorCrossTimesRef.current[sec.id] = crossingMs;
                                    segmentArmedRef.current[sec.id] = false; // disarm until moved away
                                    markSectorCrossing(sec.id, crossingMs);
                                }
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

    // Live ticking effect for current lap
    useEffect(() => {
        if (currentLapStartMs == null) return;
        let raf: number;
        let active = true;
        const tick = () => {
            if (!active) return;
            setNowMs(Date.now());
            raf = requestAnimationFrame(tick);
        };
        tick();
        return () => {
            active = false;
            if (raf) cancelAnimationFrame(raf);
        };
    }, [currentLapStartMs]);

    // Derived values for UI
    const currentLapElapsedMs = currentLapStartMs != null ? nowMs - currentLapStartMs : null;
    const lapNumber = lapTimes.length + (currentLapStartMs != null ? 1 : 0);

    // Build sector boxes list according to track.sectors order
    const sectorBoxes = React.useMemo(() => {
        const totalSectors = sectorBoundaryLines.length + 1; // internal boundaries + final sector (finish)
        const activeSectorIndex = currentLapStartMs != null ? Math.min(sectorsTiming.length + 1, totalSectors) : null;
        const boxes = [] as { index: number; time?: number; active?: boolean }[];
        for (let i = 0; i < totalSectors; i++) {
            boxes.push({index: i + 1, time: sectorsTiming[i]?.timeMs, active: activeSectorIndex === i + 1});
        }
        return boxes;
    }, [sectorsTiming, sectorBoundaryLines, currentLapStartMs]);

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
            {/* Distances panel */}
            {lineDistances.length > 0 && (
                <LapPanel title="Distances" style={{marginTop: 8}}>
                    <View style={{flexDirection: 'row', flexWrap: 'wrap', rowGap: 4, columnGap: 12}}>
                        {lineDistances.map(ld => (
                            <Text key={ld.id} style={{
                                color: colors.secondaryText,
                                fontSize: 12
                            }}>{ld.label}: {ld.distance.toFixed(1)} m</Text>
                        ))}
                    </View>
                </LapPanel>
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
                {lineDistances.length > 0 && (
                    <View style={{marginTop: 6, alignItems: 'center'}}>
                        {lineDistances.map(ld => (
                            <Text key={ld.id} style={{
                                color: colors.secondaryText,
                                fontSize: 12
                            }}>{ld.label}: {ld.distance.toFixed(1)} m</Text>
                        ))}
                    </View>
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
