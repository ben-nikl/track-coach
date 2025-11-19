/**
 * Session Storage Types
 *
 * Type definitions for storing and managing completed lap sessions
 */

import {LapRecord} from './lapSessionTypes';

/**
 * Complete session record with metadata
 */
export interface SessionRecord {
    id: string; // unique session identifier
    trackId: string; // reference to track
    trackName: string; // cached track name for display
    trackLocation: string; // cached location for display
    startTime: string; // ISO string when session started
    endTime: string; // ISO string when session ended
    laps: LapRecord[]; // all completed laps with sector splits
    totalLaps: number; // total number of laps completed
    bestLapTimeMs: number; // best lap time in session
    optimalLapTimeMs: number; // theoretical best lap from best sectors
    totalTimeMs: number; // total time spent on track
    totalDistanceKm: number; // total distance driven
}

/**
 * Summary statistics for a session
 */
export interface SessionSummary {
    totalLaps: number;
    totalTimeMs: number;
    totalDistanceKm: number;
    bestLapTimeMs: number;
    optimalLapTimeMs: number;
    optimalSectorTimes: number[]; // best time for each sector
}

/**
 * Session list item for displaying in sessions list
 */
export interface SessionListItem {
    id: string;
    trackId: string;
    trackName: string;
    trackLocation: string;
    trackFlag: any;
    startTime: string; // ISO string
    totalLaps: number;
    bestLapTimeMs: number;
}

