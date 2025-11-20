/**
 * Mock Track Manager
 *
 * Správa mock tratí - načítání, ukládání a konverze reálných session na mock tracks
 */

import {MockTrack, MockTrackPoint} from './mockLocationProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SessionRecord} from './sessionStorageTypes';
import {DrivingStateChange} from './lapSessionTypes';

const MOCK_TRACKS_STORAGE_KEY = '@track_coach:mock_tracks';

// Předdefinované mock trati
const BUILT_IN_TRACKS: MockTrack[] = [
    require('../assets/mock-tracks/autodrom-most.json'),
];

/**
 * Načte všechny dostupné mock trati (built-in + custom)
 */
export async function loadAvailableMockTracks(): Promise<MockTrack[]> {
    try {
        const customTracksJson = await AsyncStorage.getItem(MOCK_TRACKS_STORAGE_KEY);
        const customTracks: MockTrack[] = customTracksJson ? JSON.parse(customTracksJson) : [];

        return [...BUILT_IN_TRACKS, ...customTracks];
    } catch (error) {
        console.error('Failed to load custom mock tracks:', error);
        return BUILT_IN_TRACKS;
    }
}

/**
 * Načte konkrétní mock track podle ID
 */
export async function loadMockTrackById(trackId: string): Promise<MockTrack | null> {
    const allTracks = await loadAvailableMockTracks();
    return allTracks.find(t => t.trackId === trackId) || null;
}

/**
 * Uloží custom mock track
 */
export async function saveMockTrack(track: MockTrack): Promise<void> {
    try {
        const customTracksJson = await AsyncStorage.getItem(MOCK_TRACKS_STORAGE_KEY);
        const customTracks: MockTrack[] = customTracksJson ? JSON.parse(customTracksJson) : [];

        // Nahraď existující nebo přidej nový
        const existingIndex = customTracks.findIndex(t => t.trackId === track.trackId);
        if (existingIndex >= 0) {
            customTracks[existingIndex] = track;
        } else {
            customTracks.push(track);
        }

        await AsyncStorage.setItem(MOCK_TRACKS_STORAGE_KEY, JSON.stringify(customTracks));
    } catch (error) {
        console.error('Failed to save mock track:', error);
        throw error;
    }
}

/**
 * Smaže custom mock track
 */
export async function deleteMockTrack(trackId: string): Promise<void> {
    try {
        const customTracksJson = await AsyncStorage.getItem(MOCK_TRACKS_STORAGE_KEY);
        const customTracks: MockTrack[] = customTracksJson ? JSON.parse(customTracksJson) : [];

        const filtered = customTracks.filter(t => t.trackId !== trackId);
        await AsyncStorage.setItem(MOCK_TRACKS_STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Failed to delete mock track:', error);
        throw error;
    }
}

/**
 * Převede reálnou session na mock track pro budoucí testování
 */
export function convertSessionToMockTrack(
    session: SessionRecord,
    lapIndex: number = 0
): MockTrack | null {
    const lap = session.laps[lapIndex];
    if (!lap) return null;

    const points: MockTrackPoint[] = [];

    // Pokud má lap optimalizované state changes, použij je
    if (lap.drivingStateChanges && lap.drivingStateChanges.length > 0) {
        points.push(...convertStateChangesToMockPoints(lap.drivingStateChanges));
    }
    // Fallback na trajectory points
    else if (lap.trajectoryPoints && lap.trajectoryPoints.length > 0) {
        points.push(...convertTrajectoryPointsToMockPoints(lap.trajectoryPoints));
    } else {
        return null;
    }

    if (points.length === 0) return null;

    // Normalizuj timestamps (začni od 0)
    const firstTimestamp = points[0].timestamp;
    points.forEach(p => {
        p.timestamp -= firstTimestamp;
    });

    const duration = points[points.length - 1].timestamp;

    return {
        trackName: `${session.trackName} - Session ${session.sessionStartTime}`,
        trackId: `custom-${session.sessionId}-lap${lapIndex}`,
        description: `Exported from real session on ${new Date(session.sessionStartTime).toLocaleDateString()}`,
        points,
        duration,
    };
}

/**
 * Převede state changes na mock points (s interpolací mezi změnami)
 */
function convertStateChangesToMockPoints(stateChanges: DrivingStateChange[]): MockTrackPoint[] {
    const mockPoints: MockTrackPoint[] = [];

    for (let i = 0; i < stateChanges.length; i++) {
        const change = stateChanges[i];
        mockPoints.push({
            latitude: change.latitude,
            longitude: change.longitude,
            timestamp: change.timestamp,
            speed: change.speed,
            accuracy: 5, // assumed good accuracy
        });

        // Interpoluj body mezi změnami pro plynulejší trajektorii
        if (i < stateChanges.length - 1) {
            const nextChange = stateChanges[i + 1];
            const timeDiff = nextChange.timestamp - change.timestamp;

            // Přidej interpolované body každých 500ms
            if (timeDiff > 1000) {
                const steps = Math.floor(timeDiff / 500);
                for (let step = 1; step < steps; step++) {
                    const ratio = step / steps;
                    mockPoints.push({
                        latitude: change.latitude + (nextChange.latitude - change.latitude) * ratio,
                        longitude: change.longitude + (nextChange.longitude - change.longitude) * ratio,
                        timestamp: change.timestamp + timeDiff * ratio,
                        speed: change.speed + (nextChange.speed - change.speed) * ratio,
                        accuracy: 5,
                    });
                }
            }
        }
    }

    return mockPoints;
}

/**
 * Převede trajectory points na mock points
 */
function convertTrajectoryPointsToMockPoints(trajectoryPoints: any[]): MockTrackPoint[] {
    return trajectoryPoints.map(point => ({
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: point.timestamp,
        speed: point.speed || 0,
        accuracy: point.accuracy || 10,
    }));
}

