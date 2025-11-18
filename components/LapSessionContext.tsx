import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import * as Location from 'expo-location';
import {Track} from '../data/tracks';
import {computePerpendicularSegment} from '../helpers/generatePerpendicularSectors';
import {distancePointToSegmentMeters, intersectionParamT, segmentsIntersect} from '../helpers/geo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {formatLapTime} from './LapTimerScreen/format';

export type LapEventType = 'start' | 'sector' | 'finish';

export interface LapEvent {
    id: string;
    type: LapEventType;
    lapIndex: number; // 1-based
    sectorIndex?: number; // 1-based for sector events, final segment optional
    timestampMs: number; // epoch ms of crossing (interpolated)
    wallClockISO: string; // ISO timestamp at logging
    lapElapsedMs?: number; // time since lap start
    splitMs?: number; // sector split length
}

export interface LapRecord {
    lapIndex: number; // 1-based
    lapTimeMs: number;
    sectorSplitsMs: number[]; // ordered splits, last includes finish segment
}

interface SectorTimingState {
    id: string;
    timeMs?: number
}

interface ToastMsg {
    id: string;
    text: string
}

// Timing constants (session-wide)
const LINE_HALF_WIDTH_M = 12;
const REQUIRED_ACCURACY_M = 15;
const START_DEBOUNCE_MS = 1200;
const SEGMENT_DEBOUNCE_MS = 800;
const FINISH_DEBOUNCE_MS = 800;
const LINE_REARM_DISTANCE_M = 6;

interface LapSessionContextValue {
    // previously existing
    events: LapEvent[];
    laps: LapRecord[];
    logStart: (timestampMs: number) => void; // kept for backward compatibility (internal use)
    logSector: (timestampMs: number, lapElapsedMs: number, splitMs: number, sectorIndex: number) => void; // internal
    logFinish: (timestampMs: number, lapElapsedMs: number, lapTimeMs: number, finalSplitMs: number, sectorSplitsMs: number[]) => void; // internal
    resetSession: () => void;
    // new API
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
    sectorBoxes: { index: number; time?: number; active: boolean }[];
    ghostLapMs?: number;
}

const LapSessionContext = createContext<LapSessionContextValue | undefined>(undefined);

export const LapSessionProvider: React.FC<{ children: React.ReactNode }> = ({children}) => {
    // existing logging state
    const [events, setEvents] = useState<LapEvent[]>([]);
    const [laps, setLaps] = useState<LapRecord[]>([]);
    const [currentLapIndex, setCurrentLapIndex] = useState(0);

    // session tracking state
    const [trackData, setTrackData] = useState<Track | null>(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [lapTimes, setLapTimes] = useState<number[]>([]);
    const [currentLapStartMs, setCurrentLapStartMs] = useState<number | null>(null);
    const [lastLapMs, setLastLapMs] = useState<number | null>(null);
    const [bestLapMs, setBestLapMs] = useState<number | null>(null);
    const [sectorsTiming, setSectorsTiming] = useState<SectorTimingState[]>([]);
    const [nowMs, setNowMs] = useState<number>(Date.now());
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [lineDistances, setLineDistances] = useState<{ id: string; label: string; distance: number }[]>([]);
    const [toastMessages, setToastMessages] = useState<ToastMsg[]>([]);

    // refs for location & logic
    const prevLocationRef = useRef<Location.LocationObject | null>(null);
    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const startArmedRef = useRef<boolean>(true);
    const finishArmedRef = useRef<boolean>(true);
    const segmentArmedRef = useRef<Record<string, boolean>>({});
    const lastSectorCrossTimesRef = useRef<Record<string, number>>({});
    const prevSectorCrossMsRef = useRef<number | null>(null);
    const lastStartCrossRef = useRef<number>(0);
    const lastFinishCrossRef = useRef<number>(0);

    // geometry memo-like caches (recomputed on track change)
    const startFinishSegmentsRef = useRef<{ start: any; finish: any } | null>(null);
    const sectorSegmentsRef = useRef<{ id: string; seg: any }[]>([]);
    const sectorBoundaryLinesRef = useRef(trackData ? trackData.sectors : []);
    const isSameStartFinishRef = useRef(false);

    const addToast = (text: string) => {
        const id = Math.random().toString(36).slice(2);
        setToastMessages(m => [...m, {id, text}]);
        setTimeout(() => setToastMessages(m => m.filter(t => t.id !== id)), 2200);
    };

    // logging methods (unchanged logic)
    const logStart = useCallback((timestampMs: number) => {
        const lapIndex = currentLapIndex + 1;
        setCurrentLapIndex(lapIndex);
        const ev: LapEvent = {
            id: Math.random().toString(36).slice(2),
            type: 'start',
            lapIndex,
            timestampMs,
            wallClockISO: new Date().toISOString(),
            lapElapsedMs: 0,
        };
        setEvents(prev => [...prev, ev]);
    }, [currentLapIndex]);

    const logSector = useCallback((timestampMs: number, lapElapsedMs: number, splitMs: number, sectorIndex: number) => {
        const ev: LapEvent = {
            id: Math.random().toString(36).slice(2),
            type: 'sector',
            lapIndex: currentLapIndex,
            sectorIndex,
            timestampMs,
            wallClockISO: new Date().toISOString(),
            lapElapsedMs,
            splitMs,
        };
        setEvents(prev => [...prev, ev]);
    }, [currentLapIndex]);

    const logFinish = useCallback((timestampMs: number, lapElapsedMs: number, lapTimeMs: number, finalSplitMs: number, sectorSplitsMs: number[]) => {
        const ev: LapEvent = {
            id: Math.random().toString(36).slice(2),
            type: 'finish',
            lapIndex: currentLapIndex,
            timestampMs,
            wallClockISO: new Date().toISOString(),
            lapElapsedMs,
            splitMs: finalSplitMs,
        };
        setEvents(prev => [...prev, ev]);
        const record: LapRecord = {
            lapIndex: currentLapIndex,
            lapTimeMs,
            sectorSplitsMs: sectorSplitsMs,
        };
        setLaps(prev => [...prev, record]);
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
        toastMessages.length && setToastMessages([]);
    }, [toastMessages.length]);

    // derive geometry when track changes
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
        // determine same start/finish
        if (!trackData.finishLine || trackData.startLine.id === trackData.finishLine.id) {
            isSameStartFinishRef.current = true;
        } else {
            const tol = 1e-9;
            isSameStartFinishRef.current = Math.abs(s.start.latitude - f.start.latitude) < tol &&
                Math.abs(s.start.longitude - f.start.longitude) < tol &&
                Math.abs(s.end.latitude - f.end.latitude) < tol &&
                Math.abs(s.end.longitude - f.end.longitude) < tol;
        }
        // reset armed states
        segmentArmedRef.current = {};
        lastSectorCrossTimesRef.current = {};
        sectorSegmentsRef.current.forEach(sec => {
            segmentArmedRef.current[sec.id] = true;
            lastSectorCrossTimesRef.current[sec.id] = 0;
        });
        startArmedRef.current = true;
        finishArmedRef.current = true;
    }, [trackData]);

    // load persisted laps when track changes
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

    // helper: defer logging (avoid blocking UI)
    const defer = (fn: () => void) => setTimeout(fn, 0);

    const markSectorCrossing = (sectorId: string, crossingTimeMs: number) => {
        setSectorsTiming(prev => {
            if (prev.some(s => s.id === sectorId)) return prev; // already recorded for this lap
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
        sectorSegmentsRef.current.forEach(sec => (segmentArmedRef.current[sec.id] = true));
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
            const expectedSplitsTotal = sectorBoundaryLinesRef.current.length + 1;
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
        if (isSameStartFinishRef.current) {
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

    // location subscription lifecycle (active session only)
    useEffect(() => {
        let cancelled = false;
        const attach = async () => {
            if (!sessionActive || !trackData) return;
            const {status} = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setPermissionError('Location permission denied');
                return;
            }
            // iOS activity type optimization
            if ((Location as any).setActivityTypeAsync) {
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
                    const segs = startFinishSegmentsRef.current;
                    if (!prev || !segs) return;
                    const {start, finish} = segs;
                    const p1 = {latitude: prev.coords.latitude, longitude: prev.coords.longitude};
                    const p2 = {latitude: loc.coords.latitude, longitude: loc.coords.longitude};
                    const tPrev = prev.timestamp;
                    const tCur = loc.timestamp;

                    // distances & rearming
                    try {
                        const sameLine = isSameStartFinishRef.current;
                        const distances: { id: string; label: string; distance: number }[] = [];
                        const startDist = distancePointToSegmentMeters(p2, start.start, start.end);
                        if (!startArmedRef.current && startDist >= LINE_REARM_DISTANCE_M) startArmedRef.current = true;
                        distances.push({
                            id: trackData.startLine.id,
                            label: sameLine ? 'START/FINISH' : 'START',
                            distance: startDist
                        });
                        sectorSegmentsRef.current.forEach(sec => {
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

                    // start crossing
                    if (currentLapStartMs == null) {
                        if (startArmedRef.current && segmentsIntersect(p1, p2, start.start, start.end)) {
                            const tParam = intersectionParamT(p1, p2, start.start, start.end) ?? 0;
                            const crossingMs = Math.round(tPrev + tParam * (tCur - tPrev));
                            if (crossingMs - lastStartCrossRef.current > START_DEBOUNCE_MS) {
                                lastStartCrossRef.current = crossingMs;
                                startArmedRef.current = false;
                                startLap(crossingMs);
                                if (isSameStartFinishRef.current) finishArmedRef.current = false;
                            }
                        }
                        return;
                    }

                    // finish crossing
                    if (finishArmedRef.current && segmentsIntersect(p1, p2, finish.start, finish.end)) {
                        const tParam = intersectionParamT(p1, p2, finish.start, finish.end) ?? 0;
                        const crossingMs = Math.round(tPrev + tParam * (tCur - tPrev));
                        if (crossingMs - lastFinishCrossRef.current > FINISH_DEBOUNCE_MS) {
                            lastFinishCrossRef.current = crossingMs;
                            finishArmedRef.current = false;
                            finishLap(crossingMs);
                        }
                    } else {
                        // sector crossings
                        sectorSegmentsRef.current.forEach(sec => {
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
        };
        attach();
        return () => {
            cancelled = true;
            locationSubRef.current?.remove();
            locationSubRef.current = null;
        };
    }, [sessionActive, trackData, currentLapStartMs, sectorsTiming]);

    // live lap timer tick
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

    // public derived values
    const currentLapElapsedMs = currentLapStartMs != null ? nowMs - currentLapStartMs : null;
    const lapNumber = lapTimes.length + (currentLapStartMs != null ? 1 : 0);
    const ghostLapMs = bestLapMs ?? undefined;
    const sectorBoxes = (() => {
        const totalSectors = sectorBoundaryLinesRef.current.length + 1; // + final segment
        const activeIndex = currentLapStartMs != null ? Math.min(sectorsTiming.length + 1, totalSectors) : null;
        return Array.from({length: totalSectors}, (_, i) => ({
            index: i + 1,
            time: sectorsTiming[i]?.timeMs,
            active: activeIndex === i + 1
        }));
    })();

    // API: start & end session
    const startSession = (track: Track) => {
        setTrackData(track);
        setSessionActive(true);
        // reset timing state
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
        addToast('Session started');
    };

    const endSession = () => {
        setSessionActive(false);
        locationSubRef.current?.remove();
        locationSubRef.current = null;
        addToast('Session ended');
    };

    return (
        <LapSessionContext.Provider value={{
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
        }}>
            {children}
        </LapSessionContext.Provider>
    );
};

export function useLapSession() {
    const ctx = useContext(LapSessionContext);
    if (!ctx) throw new Error('useLapSession must be used within LapSessionProvider');
    return ctx;
}
