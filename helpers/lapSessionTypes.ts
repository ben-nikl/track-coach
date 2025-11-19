/**
 * Lap Session Types and Constants
 *
 * Centralized type definitions and configuration constants for the lap timing system
 */

// ============================================================================
// Configuration Constants
// ============================================================================

/** Half-width of timing lines in meters (total width = 2 * LINE_HALF_WIDTH_M) */
export const LINE_HALF_WIDTH_M = 12;

/** Required GPS accuracy in meters to process location data */
export const REQUIRED_ACCURACY_M = 15;

/** Debounce time for start line crossings (prevents double-triggers) */
export const START_DEBOUNCE_MS = 1200;

/** Debounce time for sector line crossings */
export const SEGMENT_DEBOUNCE_MS = 800;

/** Debounce time for finish line crossings */
export const FINISH_DEBOUNCE_MS = 800;

/** Distance in meters required to re-arm a timing line after crossing */
export const LINE_REARM_DISTANCE_M = 6;

// ============================================================================
// Event and Lap Types
// ============================================================================

export type LapEventType = 'start' | 'sector' | 'finish';

/**
 * Represents a timing event during a lap session
 * Events are logged chronologically and include interpolated timestamps
 */
export interface LapEvent {
    id: string;
    type: LapEventType;
    lapIndex: number;
    sectorIndex?: number;
    timestampMs: number;
    wallClockISO: string;
    lapElapsedMs?: number;
    splitMs?: number;
}

/**
 * Complete record of a finished lap with all sector splits
 */
export interface LapRecord {
    lapIndex: number;
    lapTimeMs: number;
    sectorSplitsMs: number[];
    trajectoryPoints?: TrajectoryPoint[];
}

/**
 * GPS trajectory point captured during a lap
 */
export interface TrajectoryPoint {
    latitude: number;
    longitude: number;
    timestamp: number;
    speed?: number;
    accuracy?: number;
}

// ============================================================================
// Internal State Types
// ============================================================================

/**
 * Sector timing state - tracks which sectors have been crossed
 */
export interface SectorTimingState {
    id: string;
    timeMs?: number;
}

/**
 * Toast notification message
 */
export interface ToastMsg {
    id: string;
    text: string;
}

/**
 * Sector box display state for UI
 */
export interface SectorBox {
    index: number;
    time?: number;
    active: boolean;
}

