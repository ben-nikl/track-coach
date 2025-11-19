/**
 * Session Storage Manager
 *
 * Handles persistence of completed lap sessions using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {SessionListItem, SessionRecord, SessionSummary} from './sessionStorageTypes';
import {LapRecord} from './lapSessionTypes';

const SESSIONS_INDEX_KEY = 'sessions:index';
const SESSION_KEY_PREFIX = 'session:';

/**
 * Calculate optimal lap time from best sector times across all laps
 */
export function calculateOptimalLap(laps: LapRecord[]): { optimalTimeMs: number; optimalSectorTimes: number[] } {
    if (laps.length === 0) {
        return {optimalTimeMs: 0, optimalSectorTimes: []};
    }

    // Find the number of sectors from the first lap
    const numSectors = laps[0].sectorSplitsMs.length;

    // Find best time for each sector across all laps
    const optimalSectorTimes: number[] = [];
    for (let sectorIdx = 0; sectorIdx < numSectors; sectorIdx++) {
        let bestTime = Infinity;
        for (const lap of laps) {
            if (lap.sectorSplitsMs[sectorIdx] != null && lap.sectorSplitsMs[sectorIdx] < bestTime) {
                bestTime = lap.sectorSplitsMs[sectorIdx];
            }
        }
        optimalSectorTimes.push(bestTime === Infinity ? 0 : bestTime);
    }

    const optimalTimeMs = optimalSectorTimes.reduce((sum, time) => sum + time, 0);
    return {optimalTimeMs, optimalSectorTimes};
}

/**
 * Calculate total distance from lap data (approximate)
 * Assumes each lap is roughly the same distance
 */
export function calculateTotalDistance(trackLengthKm: number, totalLaps: number): number {
    return trackLengthKm * totalLaps;
}

/**
 * Save a completed session
 */
export async function saveSession(session: SessionRecord): Promise<void> {
    try {
        // Save the session data
        await AsyncStorage.setItem(
            `${SESSION_KEY_PREFIX}${session.id}`,
            JSON.stringify(session)
        );

        // Update the sessions index
        const indexRaw = await AsyncStorage.getItem(SESSIONS_INDEX_KEY);
        const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];

        if (!index.includes(session.id)) {
            index.unshift(session.id); // Add to beginning (most recent first)
            await AsyncStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(index));
        }
    } catch (error) {
        console.error('Failed to save session:', error);
        throw error;
    }
}

/**
 * Load all sessions (returns list items for display)
 */
export async function loadAllSessions(): Promise<SessionListItem[]> {
    try {
        const indexRaw = await AsyncStorage.getItem(SESSIONS_INDEX_KEY);
        if (!indexRaw) return [];

        const index: string[] = JSON.parse(indexRaw);
        const sessions: SessionListItem[] = [];

        for (const sessionId of index) {
            const sessionRaw = await AsyncStorage.getItem(`${SESSION_KEY_PREFIX}${sessionId}`);
            if (sessionRaw) {
                const session: SessionRecord = JSON.parse(sessionRaw);
                sessions.push({
                    id: session.id,
                    trackId: session.trackId,
                    trackName: session.trackName,
                    trackLocation: session.trackLocation,
                    trackFlag: null, // Will be loaded separately
                    startTime: session.startTime,
                    totalLaps: session.totalLaps,
                    bestLapTimeMs: session.bestLapTimeMs,
                });
            }
        }

        return sessions;
    } catch (error) {
        console.error('Failed to load sessions:', error);
        return [];
    }
}

/**
 * Load a specific session by ID
 */
export async function loadSession(sessionId: string): Promise<SessionRecord | null> {
    try {
        const sessionRaw = await AsyncStorage.getItem(`${SESSION_KEY_PREFIX}${sessionId}`);
        if (!sessionRaw) return null;
        return JSON.parse(sessionRaw);
    } catch (error) {
        console.error('Failed to load session:', error);
        return null;
    }
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
    try {
        // Remove the session data
        await AsyncStorage.removeItem(`${SESSION_KEY_PREFIX}${sessionId}`);

        // Update the index
        const indexRaw = await AsyncStorage.getItem(SESSIONS_INDEX_KEY);
        if (indexRaw) {
            const index: string[] = JSON.parse(indexRaw);
            const updatedIndex = index.filter(id => id !== sessionId);
            await AsyncStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(updatedIndex));
        }
    } catch (error) {
        console.error('Failed to delete session:', error);
        throw error;
    }
}

/**
 * Calculate session summary statistics
 */
export function calculateSessionSummary(session: SessionRecord): SessionSummary {
    const {optimalTimeMs, optimalSectorTimes} = calculateOptimalLap(session.laps);

    return {
        totalLaps: session.totalLaps,
        totalTimeMs: session.totalTimeMs,
        totalDistanceKm: session.totalDistanceKm,
        bestLapTimeMs: session.bestLapTimeMs,
        optimalLapTimeMs: optimalTimeMs,
        optimalSectorTimes,
    };
}

