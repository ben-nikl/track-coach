import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Track} from '../data/tracks';
import {computePerpendicularSegment} from '../helpers/generatePerpendicularSectors';
import {formatLapTime} from './LapTimerScreen/format';
import {
    attachLocationSubscriber,
    detachLocationSubscriber,
    ensureBackgroundUpdates,
    stopBackgroundUpdates
} from '../background/LocationTask';
import {FusedSample, highFrequencyLocationManager} from '../background/HighFrequencyLocationManager';
import {
    checkFinishLineCrossing,
    checkSectorCrossings,
    checkStartLineCrossing,
    computeLineDistances,
    LineSegment,
    Point,
    updateLineArmingStates
} from '../helpers/lineCrossing';
import {
    FINISH_DEBOUNCE_MS,
    LapEvent,
    LapRecord,
    LINE_HALF_WIDTH_M,
    LINE_REARM_DISTANCE_M,
    REQUIRED_ACCURACY_M,
    SectorBox,
    SectorTimingState,
    SEGMENT_DEBOUNCE_MS,
    START_DEBOUNCE_MS,
    ToastMsg,
    TrajectoryPoint
} from '../helpers/lapSessionTypes';
import {TrajectoryManager} from '../helpers/trajectoryManager';
import {calculateOptimalLap, calculateTotalDistance, saveSession} from '../helpers/sessionStorage';
import {SessionRecord} from '../helpers/sessionStorageTypes';

interface LapSessionContextValue {
    events: LapEvent[];
    laps: LapRecord[];
    logStart: (t: number) => void;
    logSector: (t: number, l: number, s: number, i: number) => void;
    logFinish: (t: number, l: number, lap: number, finalSplit: number, sectorSplits: number[]) => void;
    resetSession: () => void;
    startSession: (track: Track) => void;
    endSession: () => void;
    sessionActive: boolean;
    trackData: Track | null;
    permissionError: string | null;
    lapTimes: number[];
    currentLapStartMs: number | null;
    lastLapMs: number | null;
    bestLapMs: number | null;
    sectorsTiming: SectorTimingState[];
    lineDistances: { id: string; label: string; distance: number }[];
    toastMessages: ToastMsg[];
    currentLapElapsedMs: number | null;
    lapNumber: number;
    sectorBoxes: SectorBox[];
    ghostLapMs?: number;
    lastFusedSample: FusedSample | null;
    fusedSpeedMps: number | null;
    selectedLapIndex: number | null;
    setSelectedLapIndex: (index: number | null) => void;
    getTrajectoryForLap: (lapIndex: number) => TrajectoryPoint[] | undefined;
}

const LapSessionContext = createContext<LapSessionContextValue | undefined>(undefined);

export const LapSessionProvider: React.FC<{ children: React.ReactNode }> = ({children}) => {
    // logging state
    const [events, setEvents] = useState<LapEvent[]>([]);
    const [laps, setLaps] = useState<LapRecord[]>([]);
    const [currentLapIndex, setCurrentLapIndex] = useState(0);

    // session state
    const [trackData, setTrackData] = useState<Track | null>(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);
    const [lapTimes, setLapTimes] = useState<number[]>([]);
    const [currentLapStartMs, setCurrentLapStartMs] = useState<number | null>(null);
    const [lastLapMs, setLastLapMs] = useState<number | null>(null);
    const [bestLapMs, setBestLapMs] = useState<number | null>(null);
    const [sectorsTiming, setSectorsTiming] = useState<SectorTimingState[]>([]);
    const [nowMs, setNowMs] = useState<number>(Date.now());
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [lineDistances, setLineDistances] = useState<{ id: string; label: string; distance: number }[]>([]);
    const [toastMessages, setToastMessages] = useState<ToastMsg[]>([]);
    const [lastFusedSample, setLastFusedSample] = useState<FusedSample | null>(null);
    const [fusedSpeedMps, setFusedSpeedMps] = useState<number | null>(null);
    const [selectedLapIndex, setSelectedLapIndex] = useState<number | null>(null);

    // Trajectory manager
    const trajectoryManagerRef = useRef(new TrajectoryManager());

    const fusedThrottleRef = useRef<number>(0);
    const lastFusedSampleRef = useRef<FusedSample | null>(null);

    // refs
    const prevLocationRef = useRef<Location.LocationObject | null>(null);
    const prevFusedRef = useRef<FusedSample | null>(null);
    const startArmedRef = useRef(true);
    const finishArmedRef = useRef(true);
    const segmentArmedRef = useRef<Record<string, boolean>>({});
    const lastSectorCrossTimesRef = useRef<Record<string, number>>({});
    const prevSectorCrossMsRef = useRef<number | null>(null);
    const lastStartCrossRef = useRef(0);
    const lastFinishCrossRef = useRef(0);
    const crossingLockRef = useRef(false);

    // geometry caches
    const startFinishSegmentsRef = useRef<{ start: LineSegment; finish: LineSegment } | null>(null);
    const sectorSegmentsRef = useRef<{ id: string; seg: LineSegment }[]>([]);
    const sectorBoundaryLinesRef = useRef(trackData ? trackData.sectors : []);
    const isSameStartFinishRef = useRef(false);
    const sectorsTimingRef = useRef<SectorTimingState[]>([]);

    useEffect(() => {
        sectorsTimingRef.current = sectorsTiming;
    }, [sectorsTiming]);

    const markSectorCrossingRef = useRef<((id: string, t: number) => void) | null>(null);
    const finishLapRef = useRef<((t: number) => void) | null>(null);
    const trackDataRef = useRef<Track | null>(null);
    const sessionActiveRef = useRef<boolean>(false);
    const currentLapStartMsRef = useRef<number | null>(null);

    // sync refs with state
    useEffect(() => {
        trackDataRef.current = trackData;
    }, [trackData]);
    useEffect(() => {
        sessionActiveRef.current = sessionActive;
    }, [sessionActive]);
    useEffect(() => {
        currentLapStartMsRef.current = currentLapStartMs;
    }, [currentLapStartMs]);

    const startLapRef = useRef<((t: number) => void) | null>(null);
    const fusedSubscribeCallbackRef = useRef<((s: FusedSample) => void) | null>(null);

    const addToast = useCallback((text: string) => {
        const id = Math.random().toString(36).slice(2);
        setToastMessages(m => [...m, {id, text}]);
        setTimeout(() => setToastMessages(m => m.filter(t => t.id !== id)), 2200);
    }, []);

    const defer = (fn: () => void) => setTimeout(fn, 0);

    const logStart = useCallback((timestampMs: number) => {
        const lapIndex = currentLapIndex + 1;
        setCurrentLapIndex(lapIndex);
        setEvents(p => [...p, {
            id: Math.random().toString(36).slice(2),
            type: 'start',
            lapIndex,
            timestampMs,
            wallClockISO: new Date().toISOString(),
            lapElapsedMs: 0
        }]);
    }, [currentLapIndex]);

    const logSector = useCallback((timestampMs: number, lapElapsedMs: number, splitMs: number, sectorIndex: number) => {
        setEvents(p => [...p, {
            id: Math.random().toString(36).slice(2),
            type: 'sector',
            lapIndex: currentLapIndex,
            sectorIndex,
            timestampMs,
            wallClockISO: new Date().toISOString(),
            lapElapsedMs,
            splitMs
        }]);
    }, [currentLapIndex]);

    const logFinish = useCallback((timestampMs: number, lapElapsedMs: number, lapTimeMs: number, finalSplitMs: number, sectorSplitsMs: number[]) => {
        setEvents(p => [...p, {
            id: Math.random().toString(36).slice(2),
            type: 'finish',
            lapIndex: currentLapIndex,
            timestampMs,
            wallClockISO: new Date().toISOString(),
            lapElapsedMs,
            splitMs: finalSplitMs
        }]);

        // Store trajectory with lap record
        const trajectoryPoints = trajectoryManagerRef.current.finishLap(currentLapIndex);

        setLaps(p => [...p, {lapIndex: currentLapIndex, lapTimeMs, sectorSplitsMs, trajectoryPoints}]);
    }, [currentLapIndex]);

    const resetSession = useCallback(() => {
        setEvents([]);
        setLaps([]);
        setCurrentLapIndex(0);
        setLapTimes([]);
        setCurrentLapStartMs(null);
        setLastLapMs(null);
        setBestLapMs(null);
        setSectorsTiming([]);
        prevSectorCrossMsRef.current = null;
        trajectoryManagerRef.current.clearAll();
        setSelectedLapIndex(null);
        toastMessages.length && setToastMessages([]);
    }, [toastMessages.length]);

    // geometry recompute
    useEffect(() => {
        if (!trackData) {
            startFinishSegmentsRef.current = null;
            sectorSegmentsRef.current = [];
            sectorBoundaryLinesRef.current = [];
            isSameStartFinishRef.current = false;
            return;
        }
        const s = computePerpendicularSegment(trackData.startLine.center, trackData.startLine.trackP1, trackData.startLine.trackP2, LINE_HALF_WIDTH_M);
        const finishSource = trackData.finishLine ?? trackData.startLine;
        const f = computePerpendicularSegment(finishSource.center, finishSource.trackP1, finishSource.trackP2, LINE_HALF_WIDTH_M);
        startFinishSegmentsRef.current = {start: s, finish: f};
        sectorSegmentsRef.current = trackData.sectors.map(sec => ({
            id: sec.id,
            seg: computePerpendicularSegment(sec.center, sec.trackP1, sec.trackP2, LINE_HALF_WIDTH_M)
        }));
        sectorBoundaryLinesRef.current = trackData.sectors;
        if (!trackData.finishLine || trackData.startLine.id === trackData.finishLine.id) {
            isSameStartFinishRef.current = true;
        } else {
            const tol = 1e-9;
            isSameStartFinishRef.current = Math.abs(s.start.latitude - f.start.latitude) < tol && Math.abs(s.start.longitude - f.start.longitude) < tol && Math.abs(s.end.latitude - f.end.latitude) < tol && Math.abs(s.end.longitude - f.end.longitude) < tol;
        }
        segmentArmedRef.current = {};
        lastSectorCrossTimesRef.current = {};
        sectorSegmentsRef.current.forEach(sec => {
            segmentArmedRef.current[sec.id] = true;
            lastSectorCrossTimesRef.current[sec.id] = 0;
        });
        startArmedRef.current = true;
        finishArmedRef.current = true;
    }, [trackData]);

    // load persisted laps
    useEffect(() => {
        (async () => {
            if (!trackData) return;
            try {
                const raw = await AsyncStorage.getItem(`laps:${trackData.id}`);
                if (raw) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) setLapTimes(arr.filter(n => typeof n === 'number'));
                }
            } catch {
            }
        })();
    }, [trackData]);

    const markSectorCrossing = useCallback((sectorId: string, crossingTimeMs: number) => {
        setSectorsTiming(prev => {
            if (prev.some(s => s.id === sectorId)) return prev;
            const base = prevSectorCrossMsRef.current ?? currentLapStartMs ?? crossingTimeMs;
            const split = crossingTimeMs - base;
            const lapElapsed = currentLapStartMs != null ? crossingTimeMs - currentLapStartMs : split;
            prevSectorCrossMsRef.current = crossingTimeMs;
            addToast(`SECTOR split #${prev.length + 1}: ${formatLapTime(split)}`);
            if (currentLapStartMs != null) defer(() => logSector(crossingTimeMs, lapElapsed, split, prev.length + 1));
            return [...prev, {id: sectorId, timeMs: split}];
        });
    }, [currentLapStartMs, logSector, addToast]);

    useEffect(() => {
        markSectorCrossingRef.current = markSectorCrossing;
    }, [markSectorCrossing]);

    const startLap = useCallback((startTimeMs: number) => {
        setCurrentLapStartMs(startTimeMs);
        setSectorsTiming([]);
        prevSectorCrossMsRef.current = startTimeMs;
        setNowMs(Date.now());
        sectorSegmentsRef.current.forEach(sec => segmentArmedRef.current[sec.id] = true);
        trajectoryManagerRef.current.clearCurrentLap();
        addToast('Lap started');
        defer(() => logStart(startTimeMs));
    }, [logStart, addToast]);

    const finishLap = useCallback((finishTimeMs: number) => {
        if (crossingLockRef.current) return;
        crossingLockRef.current = true;
        if (currentLapStartMs == null) {
            crossingLockRef.current = false;
            return;
        }
        const lastBoundary = prevSectorCrossMsRef.current ?? currentLapStartMs;
        const finalSplit = finishTimeMs - lastBoundary;
        const lapDuration = finishTimeMs - currentLapStartMs;
        const sectorSplitsMs = sectorsTiming.map(s => s.timeMs ?? 0);

        addToast(`Lap finished: ${formatLapTime(lapDuration)}`);
        defer(() => logFinish(finishTimeMs, finishTimeMs - currentLapStartMs, lapDuration, finalSplit, sectorSplitsMs));

        setSectorsTiming(prev => {
            const expected = sectorBoundaryLinesRef.current.length + 1;
            if (prev.length < expected) {
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
        setBestLapMs(prev => prev == null || lapDuration < prev ? lapDuration : prev);

        if (isSameStartFinishRef.current) {
            setTimeout(() => {
                startLap(finishTimeMs);
                prevSectorCrossMsRef.current = finishTimeMs;
                startArmedRef.current = false;
                finishArmedRef.current = false;
                crossingLockRef.current = false;
            }, 30);
        } else {
            setCurrentLapStartMs(null);
            setSectorsTiming([]);
            prevSectorCrossMsRef.current = null;
            crossingLockRef.current = false;
        }
    }, [currentLapStartMs, trackData, logFinish, addToast, startLap, sectorsTiming]);

    useEffect(() => {
        finishLapRef.current = finishLap;
    }, [finishLap]);

    useEffect(() => {
        startLapRef.current = startLap;
    }, [startLap]);

    const processLocation = useCallback((loc: Location.LocationObject) => {
        // GPS anchor processing (1Hz) - kept mainly to update anchor & coarse crossing fallback
        if (loc.coords.accuracy != null && loc.coords.accuracy > REQUIRED_ACCURACY_M) return;
        const prev = prevLocationRef.current;
        prevLocationRef.current = loc;
        if (!trackData) return;
        const segs = startFinishSegmentsRef.current;
        if (!segs) return;
        const {start, finish} = segs;
        const p2 = {latitude: loc.coords.latitude, longitude: loc.coords.longitude};

        try {
            const sameLine = isSameStartFinishRef.current;
            const startLineId = trackData.startLine.id;
            const finishLineId = trackData.finishLine ? trackData.finishLine.id : trackData.startLine.id;

            const distances = computeLineDistances(
                p2,
                start,
                finish,
                sectorSegmentsRef.current,
                sameLine,
                startLineId,
                finishLineId
            );
            setLineDistances(distances);
        } catch {
        }
    }, [trackData]);

    // Process fused location data for crossing detection
    const processFusedLike = (tPrev: number, latPrev: number, lonPrev: number, tCur: number, latCur: number, lonCur: number) => {
        if (crossingLockRef.current) return;

        const segs = startFinishSegmentsRef.current;
        const td = trackDataRef.current ?? trackData;
        if (!segs || !td) return;

        const {start, finish} = segs;
        const p1: Point = {latitude: latPrev, longitude: lonPrev};
        const p2: Point = {latitude: latCur, longitude: lonCur};

        try {
            // Update line arming states
            updateLineArmingStates(
                p2,
                start,
                finish,
                sectorSegmentsRef.current,
                isSameStartFinishRef.current,
                startArmedRef,
                finishArmedRef,
                segmentArmedRef,
                LINE_REARM_DISTANCE_M
            );

            // Compute and update distances
            const startLineId = td.startLine.id;
            const finishLineId = td.finishLine ? td.finishLine.id : td.startLine.id;

            const distances = computeLineDistances(
                p2,
                start,
                finish,
                sectorSegmentsRef.current,
                isSameStartFinishRef.current,
                startLineId,
                finishLineId
            );
            setLineDistances(distances);
        } catch {
        }

        if (!sessionActiveRef.current) return;

        // Check for start line crossing when lap hasn't started
        if (currentLapStartMsRef.current == null) {
            checkStartLineCrossing(
                p1,
                p2,
                tPrev,
                tCur,
                start,
                isSameStartFinishRef.current,
                startArmedRef,
                finishArmedRef,
                lastStartCrossRef,
                startLapRef.current,
                START_DEBOUNCE_MS
            );
            return;
        }

        // Check for finish line crossing
        const finishCrossed = checkFinishLineCrossing(
            p1,
            p2,
            tPrev,
            tCur,
            finish,
            finishArmedRef,
            lastFinishCrossRef,
            finishLapRef.current,
            FINISH_DEBOUNCE_MS
        );

        // Only check sector crossings if finish line wasn't crossed
        if (!finishCrossed) {
            checkSectorCrossings(
                p1,
                p2,
                tPrev,
                tCur,
                sectorSegmentsRef.current,
                segmentArmedRef,
                lastSectorCrossTimesRef,
                markSectorCrossingRef.current,
                SEGMENT_DEBOUNCE_MS
            );
        }
    };

    // Stable fused sample handler (no deps)
    const fusedSampleHandlerRef = useRef<((s: FusedSample) => void) | null>(null);
    fusedSampleHandlerRef.current = (sample: FusedSample) => {
        const td = trackDataRef.current;
        if (!td || sample.source !== 'fused') return;

        const prev = prevFusedRef.current;
        prevFusedRef.current = sample;

        if (prev) processFusedLike(prev.timestamp, prev.latitude, prev.longitude, sample.timestamp, sample.latitude, sample.longitude);

        lastFusedSampleRef.current = sample;

        // Record trajectory point during active lap
        if (currentLapStartMsRef.current != null && sessionActiveRef.current) {
            trajectoryManagerRef.current.addPoint({
                latitude: sample.latitude,
                longitude: sample.longitude,
                timestamp: sample.timestamp,
                speed: sample.speedMps,
                accuracy: sample.accuracy
            });
        }

        const now = sample.timestamp;
        if (now - fusedThrottleRef.current > 50) {
            fusedThrottleRef.current = now;
            setLastFusedSample(sample);
            setFusedSpeedMps(sample.speedMps);
        }
    };

    // location setup (foreground + background) - GPS anchor 1Hz
    useEffect(() => {
        let fgSub: Location.LocationSubscription | null = null;
        let cancelled = false;
        const setup = async () => {
            if (!sessionActive || !trackData) return;
            const fg = await Location.requestForegroundPermissionsAsync();
            if (fg.status !== 'granted') {
                setPermissionError('Foreground location denied');
                return;
            }
            try {
                const isBgAvailable = await Location.isBackgroundLocationAvailableAsync();
                if (isBgAvailable) {
                    const bg = await Location.requestBackgroundPermissionsAsync();
                    if (bg.status !== 'granted') setPermissionError('Background location denied');
                }
            } catch {
            }
            attachLocationSubscriber(processLocation);
            await ensureBackgroundUpdates();
            fgSub = await Location.watchPositionAsync({
                accuracy: Location.Accuracy.BestForNavigation,
                distanceInterval: 0,
                timeInterval: 1000
            }, loc => {
                if (!cancelled) processLocation(loc);
            });
        };
        setup();
        return () => {
            cancelled = true;
            fgSub?.remove();
            detachLocationSubscriber();
        };
    }, [sessionActive, trackData, processLocation]);

    // High-frequency fused manager lifecycle (deps only sessionActive & trackData)
    useEffect(() => {
        if (!sessionActive || !trackData) return;
        let mounted = true;
        const subscribeCallback = (s: FusedSample) => fusedSampleHandlerRef.current?.(s);
        fusedSubscribeCallbackRef.current = subscribeCallback;
        highFrequencyLocationManager.start().then(ok => {
            if (!ok || !mounted) return;
            highFrequencyLocationManager.subscribe(subscribeCallback);
        });
        return () => {
            mounted = false;
            if (fusedSubscribeCallbackRef.current) highFrequencyLocationManager.unsubscribe(fusedSubscribeCallbackRef.current);
            highFrequencyLocationManager.stop();
            prevFusedRef.current = null;
            lastFusedSampleRef.current = null;
            setLastFusedSample(null);
            setFusedSpeedMps(null);
        };
    }, [sessionActive, trackData]);

    // timer tick
    useEffect(() => {
        if (!sessionActive || currentLapStartMs == null) return;
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
    }, [sessionActive, currentLapStartMs]);

    const currentLapElapsedMs = currentLapStartMs != null ? nowMs - currentLapStartMs : null;
    const lapNumber = lapTimes.length + (currentLapStartMs != null ? 1 : 0);
    const ghostLapMs = bestLapMs ?? undefined;
    const sectorBoxes = (() => {
        const total = sectorBoundaryLinesRef.current.length + 1;
        const activeIndex = currentLapStartMs != null ? Math.min(sectorsTiming.length + 1, total) : null;
        return Array.from({length: total}, (_, i) => ({
            index: i + 1,
            time: sectorsTiming[i]?.timeMs,
            active: activeIndex === i + 1
        }));
    })();

    const startSession = useCallback((track: Track) => {
        const startTime = new Date().toISOString();
        setSessionStartTime(startTime);
        setTrackData(track);
        setSessionActive(true);
        setLapTimes([]);
        setCurrentLapStartMs(null);
        setLastLapMs(null);
        setBestLapMs(null);
        setSectorsTiming([]);
        prevSectorCrossMsRef.current = null;
        startArmedRef.current = true;
        finishArmedRef.current = true;
        segmentArmedRef.current = {};
        lastSectorCrossTimesRef.current = {};
        lastStartCrossRef.current = 0;
        lastFinishCrossRef.current = 0;
        trajectoryManagerRef.current.clearAll();
        setSelectedLapIndex(null);
        addToast('Session started');
    }, [addToast]);

    const endSession = useCallback(() => {
        setSessionActive(false);
        stopBackgroundUpdates();
        detachLocationSubscriber();
        highFrequencyLocationManager.stop();
        trajectoryManagerRef.current.clearCurrentLap();

        // Save session metadata if we have completed laps
        if (trackData && laps.length > 0 && sessionStartTime) {
            const endTime = new Date().toISOString();
            const {optimalTimeMs, optimalSectorTimes} = calculateOptimalLap(laps);
            const bestLap = Math.min(...laps.map(l => l.lapTimeMs));
            const totalTimeMs = laps.reduce((sum, lap) => sum + lap.lapTimeMs, 0);
            const totalDistance = calculateTotalDistance(trackData.trackLengthKm, laps.length);

            const sessionRecord: SessionRecord = {
                id: `session_${Date.now()}`,
                trackId: trackData.id,
                trackName: trackData.name,
                trackLocation: trackData.location,
                startTime: sessionStartTime,
                endTime,
                laps,
                totalLaps: laps.length,
                bestLapTimeMs: bestLap,
                optimalLapTimeMs: optimalTimeMs,
                totalTimeMs,
                totalDistanceKm: totalDistance,
            };

            saveSession(sessionRecord).catch(e => {
                console.error('Failed to save session', e);
            });
        }

        addToast('Session ended');
    }, [addToast, laps, trackData, sessionStartTime]);

    const getTrajectoryForLap = useCallback((lapIndex: number) => {
        return trajectoryManagerRef.current.getTrajectory(lapIndex);
    }, []);

    return <LapSessionContext.Provider value={{
        events,
        laps,
        logStart,
        logSector,
        logFinish,
        resetSession,
        startSession,
        endSession,
        sessionActive,
        trackData,
        permissionError,
        lapTimes,
        currentLapStartMs,
        lastLapMs,
        bestLapMs,
        sectorsTiming,
        lineDistances,
        toastMessages,
        currentLapElapsedMs,
        lapNumber,
        sectorBoxes,
        ghostLapMs,
        lastFusedSample,
        fusedSpeedMps,
        selectedLapIndex,
        setSelectedLapIndex,
        getTrajectoryForLap
    }}>{children}</LapSessionContext.Provider>;
};

export function useLapSession() {
    const ctx = useContext(LapSessionContext);
    if (!ctx) throw new Error('useLapSession must be used within LapSessionProvider');
    return ctx;
}
