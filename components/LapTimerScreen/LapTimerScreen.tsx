import React, {useEffect, useMemo, useRef, useState} from 'react';
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
    trackName?: string;
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

const LINE_HALF_WIDTH_M = 12;
const REQUIRED_ACCURACY_M = 15;
const START_DEBOUNCE_MS = 1200;
const SEGMENT_DEBOUNCE_MS = 800;
const FINISH_DEBOUNCE_MS = 800;
const LINE_REARM_DISTANCE_M = 6;

const LapTimerScreen: React.FC<LapTimerScreenProps> = ({trackData, onBack, onMenu}) => {
    const {colors} = useTheme();
    const insets = useSafeAreaInsets();
    const {width, height} = useWindowDimensions();
    const landscape = width > height;

    // Lap & timing state
    const [lapTimes, setLapTimes] = useState<number[]>([]);
    const [currentLapStartMs, setCurrentLapStartMs] = useState<number | null>(null);
    const [lastLapMs, setLastLapMs] = useState<number | null>(null);
    const [bestLapMs, setBestLapMs] = useState<number | null>(null);
    const [sectorsTiming, setSectorsTiming] = useState<SectorTimingState[]>([]);
    const [nowMs, setNowMs] = useState<number>(Date.now());

    // Refs for location & timing logic
    const prevLocationRef = useRef<Location.LocationObject | null>(null);
    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const startArmedRef = useRef<boolean>(true);
    const finishArmedRef = useRef<boolean>(true);
    const segmentArmedRef = useRef<Record<string, boolean>>({});
    const lastSectorCrossTimesRef = useRef<Record<string, number>>({});
    const prevSectorCrossMsRef = useRef<number | null>(null);

    // Toasts
    const [toastMessages, setToastMessages] = useState<ToastMsg[]>([]);
    const addToast = (text: string) => {
        const id = Math.random().toString(36).slice(2);
        setToastMessages(m => [...m, {id, text}]);
        setTimeout(() => setToastMessages(m => m.filter(t => t.id !== id)), 2200);
    };

    // Distance panel state
    const [lineDistances, setLineDistances] = useState<{ id: string; label: string; distance: number }[]>([]);

    // Lap session logging
    const {logStart, logSector, logFinish} = useLapSession();
    const defer = (fn: () => void) => setTimeout(fn, 0);

    // Timing lines
    const startFinishSegments = useMemo(() => {
        if (!trackData) return null;
        const s = computePerpendicularSegment(trackData.startLine.center, trackData.startLine.trackP1, trackData.startLine.trackP2, LINE_HALF_WIDTH_M);
        const finishSource = trackData.finishLine ?? trackData.startLine;
        const f = computePerpendicularSegment(finishSource.center, finishSource.trackP1, finishSource.trackP2, LINE_HALF_WIDTH_M);
        return {start: s, finish: f};
    }, [trackData]);

    const isSameStartFinish = useMemo(() => {
        if (!trackData || !startFinishSegments) return false;
        if (!trackData.finishLine) return true;
        if (trackData.startLine.id === trackData.finishLine.id) return true;
        const {start, finish} = startFinishSegments;
        const tol = 1e-9;
        return Math.abs(start.start.latitude - finish.start.latitude) < tol &&
            Math.abs(start.start.longitude - finish.start.longitude) < tol &&
            Math.abs(start.end.latitude - finish.end.latitude) < tol &&
            Math.abs(start.end.longitude - finish.end.longitude) < tol;
    }, [trackData, startFinishSegments]);

    const sectorSegments = useMemo(() => {
        if (!trackData) return [];
        return trackData.sectors.map(sec => ({
            id: sec.id,
            seg: computePerpendicularSegment(sec.center, sec.trackP1, sec.trackP2, LINE_HALF_WIDTH_M)
        }));
    }, [trackData]);

    const sectorBoundaryLines = useMemo(() => trackData ? trackData.sectors : [], [trackData]);

    // Reset lap timing when track changes
    useEffect(() => {
        setLapTimes([]);
        setCurrentLapStartMs(null);
        setLastLapMs(null);
        setBestLapMs(null);
        setSectorsTiming([]);
        prevSectorCrossMsRef.current = null;
    }, [trackData]);

    // Initialize arming refs on geometry change
    useEffect(() => {
        if (!trackData) return;
        segmentArmedRef.current = {};
        lastSectorCrossTimesRef.current = {};
        sectorSegments.forEach(sec => {
            segmentArmedRef.current[sec.id] = true;
            lastSectorCrossTimesRef.current[sec.id] = 0;
        });
        startArmedRef.current = true;
        finishArmedRef.current = true;
    }, [trackData, sectorSegments]);

    // Load persisted laps
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

    // Mark sector crossing
    const markSectorCrossing = (sectorId: string, crossingTimeMs: number) => {
        setSectorsTiming(prev => {
            if (prev.some(s => s.id === sectorId)) return prev; // already recorded this lap
            const base = prevSectorCrossMsRef.current ?? currentLapStartMs ?? crossingTimeMs;
            const split = crossingTimeMs - base;
            const lapElapsed = currentLapStartMs != null ? crossingTimeMs - currentLapStartMs : split;
            prevSectorCrossMsRef.current = crossingTimeMs;
            addToast(`SECTOR split #${prev.length + 1}: ${formatLapTime(split)}`);
            if (currentLapStartMs != null) defer(() => logSector(crossingTimeMs, lapElapsed, split, prev.length + 1));
            return [...prev, {id: sectorId, timeMs: split}];
        });
    };

    const startLap = (startTimeMs: number) => {
        setCurrentLapStartMs(startTimeMs);
        setSectorsTiming([]);
        prevSectorCrossMsRef.current = startTimeMs;
        setNowMs(Date.now());
        sectorSegments.forEach(sec => (segmentArmedRef.current[sec.id] = true));
        addToast('Lap started');
        defer(() => logStart(startTimeMs));
    };

    const finishLap = (finishTimeMs: number) => {
        if (currentLapStartMs == null) return;
        const lastBoundaryTimeBase = prevSectorCrossMsRef.current ?? currentLapStartMs;
        const finalSplit = finishTimeMs - lastBoundaryTimeBase;
        const lapDuration = finishTimeMs - currentLapStartMs;
        const sectorSplitsMs = [...sectorsTiming.map(s => s.timeMs || 0), finalSplit];
        const lapElapsed = finishTimeMs - currentLapStartMs;
        addToast(`Lap finished: ${formatLapTime(lapDuration)}`);
        defer(() => logFinish(finishTimeMs, lapElapsed, lapDuration, finalSplit, sectorSplitsMs));
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
            if (trackData) AsyncStorage.setItem(`laps:${trackData.id}`, JSON.stringify(updated)).catch(() => {
            });
            return updated;
        });
        setLastLapMs(lapDuration);
        setBestLapMs(prev => (prev == null || lapDuration < prev ? lapDuration : prev));
        if (isSameStartFinish) {
            startLap(finishTimeMs);
            prevSectorCrossMsRef.current = finishTimeMs;
            startArmedRef.current = false;
            finishArmedRef.current = false;
        } else {
            setCurrentLapStartMs(null);
            setSectorsTiming([]);
            prevSectorCrossMsRef.current = null;
        }
    };

    // Location subscription
    useEffect(() => {
        let cancelled = false;
        const lastStartCrossRef = {value: 0};
        const lastFinishCrossRef = {value: 0};

        async function init() {
            if (!trackData) return;
            const {status} = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setPermissionError('Location permission denied');
                return;
            }
            if (Platform.OS === 'ios' && (Location as any).setActivityTypeAsync) {
                try {
                    await (Location as any).setActivityTypeAsync('automotiveNavigation');
                } catch {
                }
            }
            locationSubRef.current = await Location.watchPositionAsync(
                {accuracy: Location.Accuracy.BestForNavigation, timeInterval: 0, distanceInterval: 0},
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

                    // Distance display & re-arming
                    try {
                        const sameLine = isSameStartFinish;
                        const distances: { id: string; label: string; distance: number }[] = [];
                        const startDist = distancePointToSegmentMeters(p2, start.start, start.end);
                        if (!startArmedRef.current && startDist >= LINE_REARM_DISTANCE_M) startArmedRef.current = true;
                        distances.push({
                            id: trackData.startLine.id,
                            label: sameLine ? 'START/FINISH' : 'START',
                            distance: startDist
                        });
                        sectorSegments.forEach(sec => {
                            const d = distancePointToSegmentMeters(p2, sec.seg.start, sec.seg.end);
                            if (!segmentArmedRef.current[sec.id] && d >= LINE_REARM_DISTANCE_M) segmentArmedRef.current[sec.id] = true;
                            distances.push({id: sec.id, label: sec.id.toUpperCase(), distance: d});
                        });
                        if (!sameLine) {
                            const finishDist = distancePointToSegmentMeters(p2, finish.start, finish.end);
                            if (!finishArmedRef.current && finishDist >= LINE_REARM_DISTANCE_M) finishArmedRef.current = true;
                            const finishId = trackData.finishLine ? trackData.finishLine.id : trackData.startLine.id;
                            distances.push({id: finishId, label: 'FINISH', distance: finishDist});
                        } else if (!finishArmedRef.current && startDist >= LINE_REARM_DISTANCE_M) {
                            finishArmedRef.current = true;
                        }
                        setLineDistances(distances);
                    } catch {
                    }

                    // Start crossing
                    if (currentLapStartMs == null) {
                        if (startArmedRef.current && segmentsIntersect(p1, p2, start.start, start.end)) {
                            const tParam = intersectionParamT(p1, p2, start.start, start.end) ?? 0;
                            const crossingMs = Math.round(tPrev + tParam * (tCur - tPrev));
                            if (crossingMs - lastStartCrossRef.value > START_DEBOUNCE_MS) {
                                lastStartCrossRef.value = crossingMs;
                                startArmedRef.current = false;
                                startLap(crossingMs);
                                if (isSameStartFinish) finishArmedRef.current = false;
                            }
                        }
                        return;
                    }

                    // Finish crossing
                    if (finishArmedRef.current && segmentsIntersect(p1, p2, finish.start, finish.end)) {
                        const tParam = intersectionParamT(p1, p2, finish.start, finish.end) ?? 0;
                        const crossingMs = Math.round(tPrev + tParam * (tCur - tPrev));
                        if (crossingMs - lastFinishCrossRef.value > FINISH_DEBOUNCE_MS) {
                            lastFinishCrossRef.value = crossingMs;
                            finishArmedRef.current = false;
                            finishLap(crossingMs);
                        }
                    } else {
                        // Sector crossings
                        sectorSegments.forEach(sec => {
                            if (!segmentArmedRef.current[sec.id]) return;
                            if (segmentsIntersect(p1, p2, sec.seg.start, sec.seg.end)) {
                                const tParam = intersectionParamT(p1, p2, sec.seg.start, sec.seg.end) ?? 0;
                                const crossingMs = Math.round(tPrev + tParam * (tCur - tPrev));
                                const last = lastSectorCrossTimesRef.current[sec.id] || 0;
                                if (crossingMs - last > SEGMENT_DEBOUNCE_MS) {
                                    lastSectorCrossTimesRef.current[sec.id] = crossingMs;
                                    segmentArmedRef.current[sec.id] = false;
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
    }, [trackData, startFinishSegments, sectorSegments, currentLapStartMs, isSameStartFinish]);

    // Live lap timer tick
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

    const currentLapElapsedMs = currentLapStartMs != null ? nowMs - currentLapStartMs : null;
    const lapNumber = lapTimes.length + (currentLapStartMs != null ? 1 : 0);

    const sectorBoxes = useMemo(() => {
        const totalSectors = sectorBoundaryLines.length + 1; // + final
        const activeIndex = currentLapStartMs != null ? Math.min(sectorsTiming.length + 1, totalSectors) : null;
        return Array.from({length: totalSectors}, (_, i) => ({
            index: i + 1,
            time: sectorsTiming[i]?.timeMs,
            active: activeIndex === i + 1
        }));
    }, [sectorsTiming, sectorBoundaryLines, currentLapStartMs]);

    const ghostLapMs = bestLapMs ?? undefined;

    if (!trackData) {
        return (
            <SafeAreaView
                style={[styles.portraitRoot, {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16}]}>\n <Text
                style={{color: colors.text}}>No track selected.</Text>\n <Pressable onPress={onBack}
                                                                                    style={{marginTop: 24}}><Text
                style={{color: colors.primary}}>Back to tracks</Text></Pressable>\n </SafeAreaView>
        );
    }

    const ToastOverlay = () => (
        <View pointerEvents="none" style={styles.toastContainer}>
            {toastMessages.map(t => (
                <View key={t.id}
                      style={[styles.toast, {backgroundColor: colors.surface, borderColor: colors.border}]}>\n <Text
                    style={{color: colors.text, fontSize: 12, fontWeight: '600'}}>{t.text}</Text>\n </View>
            ))}
        </View>
    );

    const distancesPanel = lineDistances.length > 0 && (
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
    );

    const header = (
        <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.headerBtn}><Text
                style={[styles.headerBtnText, {color: colors.text}]}>◄</Text></Pressable>
            <Text style={[styles.trackTitle, {color: colors.text}]} numberOfLines={1}>{trackData.name}</Text>
            <Pressable accessibilityRole="button" onPress={onMenu} style={styles.headerBtn}><Text
                style={[styles.headerBtnText, {color: colors.text}]}>⋮</Text></Pressable>
        </View>
    );

    const landscapeUI = (
        <SafeAreaView style={[styles.containerLandscape, {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16
        }]}>\n <ToastOverlay/>\n {header}\n <View style={styles.landscapeRow}>\n <View
            style={styles.landscapeLeft}>\n <LapTimeDisplay lastLapMs={lastLapMs ?? undefined}
                                                            lastLapDeltaMs={undefined} lapNumber={lapNumber}/>\n <View
            style={styles.spacer}/>\n <View style={styles.timersContainer}>\n <LapPanel title="Ghost Lap (PB)"
                                                                                        center>\n <Text
            style={[styles.panelMainTime, {color: colors.text}]}>{formatLapTime(ghostLapMs ?? NaN)}</Text>\n
        </LapPanel>\n <LapPanel title="Best Lap" style={styles.bestLapLandscape}>\n <Text
            style={[styles.panelMainTime, {color: colors.secondaryText}]}>{formatLapTime(bestLapMs ?? NaN)}</Text>\n
        </LapPanel>\n </View>\n </View>\n <View style={styles.landscapeRight}>\n <View
            style={styles.sectorsGrid}>\n {sectorBoxes.map(s => <SectorBox key={s.index} {...s} />)}\n </View>\n </View>\n
        </View>\n {currentLapElapsedMs != null && (
            <Text style={{color: colors.accent, textAlign: 'center', marginTop: 8}}>Current
                Lap: {formatLapTime(currentLapElapsedMs)}</Text>)}\n {distancesPanel}\n {permissionError && (
            <Text style={{color: colors.danger, textAlign: 'center', marginTop: 4}}>{permissionError}</Text>)}\n
        </SafeAreaView>
    );

    const portraitUI = (
        <SafeAreaView style={[styles.portraitRoot, {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16
        }]}>\n {header}\n <LapPanel title="Ghost Lap (PB)"
                                    style={[styles.ghostPortrait, styles.sectionStretch]}>\n <Text
            style={[styles.panelMainTime, {color: colors.text}]}>{formatLapTime(ghostLapMs ?? NaN)}</Text>\n
        </LapPanel>\n <View style={[styles.lastLapPortrait, styles.sectionStretch]}>\n <LapTimeDisplay
            lastLapMs={lastLapMs ?? undefined} lastLapDeltaMs={undefined}
            lapNumber={lapNumber}/>\n {currentLapElapsedMs != null && (<Text style={{
            color: colors.accent,
            marginTop: 8
        }}>Current: {formatLapTime(currentLapElapsedMs)}</Text>)}\n {distancesPanel}\n </View>\n <View
            style={styles.sectorsGridPortrait}>\n {sectorBoxes.map(s => <SectorBox
            key={s.index} {...s} />)}\n </View>\n <LapPanel title="Best Lap"
                                                            style={[styles.bestLapPortrait, styles.sectionStretch]}>\n <Text
            style={[styles.panelMainTime, {color: colors.secondaryText}]}>{formatLapTime(bestLapMs ?? NaN)}</Text>\n
        </LapPanel>\n {permissionError && (<Text style={{
            color: colors.danger,
            textAlign: 'center',
            marginTop: 4
        }}>{permissionError}</Text>)}\n <ToastOverlay/>\n </SafeAreaView>
    );

    return landscape ? landscapeUI : portraitUI;
};

const styles = StyleSheet.create({
    portraitRoot: {flex: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center'},
    sectionStretch: {alignSelf: 'stretch'},
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
