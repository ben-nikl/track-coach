import React, {createContext, useCallback, useContext, useState} from 'react';

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

interface LapSessionContextValue {
    events: LapEvent[];
    laps: LapRecord[];
    logStart: (timestampMs: number) => void;
    logSector: (timestampMs: number, lapElapsedMs: number, splitMs: number, sectorIndex: number) => void;
    logFinish: (timestampMs: number, lapElapsedMs: number, lapTimeMs: number, finalSplitMs: number, sectorSplitsMs: number[]) => void;
    resetSession: () => void;
}

const LapSessionContext = createContext<LapSessionContextValue | undefined>(undefined);

export const LapSessionProvider: React.FC<{ children: React.ReactNode }> = ({children}) => {
    const [events, setEvents] = useState<LapEvent[]>([]);
    const [laps, setLaps] = useState<LapRecord[]>([]);
    const [currentLapIndex, setCurrentLapIndex] = useState(0); // will increment on start

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
    }, []);

    return (
        <LapSessionContext.Provider value={{events, laps, logStart, logSector, logFinish, resetSession}}>
            {children}
        </LapSessionContext.Provider>
    );
};

export function useLapSession() {
    const ctx = useContext(LapSessionContext);
    if (!ctx) throw new Error('useLapSession must be used within LapSessionProvider');
    return ctx;
}

