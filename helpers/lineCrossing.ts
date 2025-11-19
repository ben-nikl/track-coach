/**
 * Line Crossing Detection Module
 *
 * This module provides utilities for detecting when a moving object (GPS position)
 * crosses virtual timing lines (start/finish/sector lines) on a racing track.
 *
 * Key concepts:
 * - Arming: A line must be "armed" before it can detect a crossing (prevents double-triggers)
 * - Debouncing: Prevents multiple crossings in quick succession
 * - Interpolation: Calculates the exact crossing time between two GPS samples
 */

import {distancePointToSegmentMeters, intersectionParamT, segmentsIntersect} from './geo';

export interface Point {
    latitude: number;
    longitude: number;
}

export interface LineSegment {
    start: Point;
    end: Point;
}

export interface DistanceResult {
    id: string;
    label: string;
    distance: number;
}

/**
 * Calculate the exact crossing time between two GPS samples
 * Uses linear interpolation based on intersection parameter
 *
 * @param tPrev - Timestamp of previous position (ms)
 * @param tCur - Timestamp of current position (ms)
 * @param p1 - Previous position
 * @param p2 - Current position
 * @param lineStart - Start point of the line to check
 * @param lineEnd - End point of the line to check
 * @returns Interpolated crossing time in milliseconds, or null if no crossing
 */
export function calculateCrossingTime(
    tPrev: number,
    tCur: number,
    p1: Point,
    p2: Point,
    lineStart: Point,
    lineEnd: Point
): number | null {
    if (!segmentsIntersect(p1, p2, lineStart, lineEnd)) return null;
    const tParam = intersectionParamT(p1, p2, lineStart, lineEnd) ?? 0;
    return Math.round(tPrev + tParam * (tCur - tPrev));
}

/**
 * Compute distances from current position to all timing lines
 * Used for proximity display and arming logic
 */
export function computeLineDistances(
    currentPoint: Point,
    startSegment: LineSegment,
    finishSegment: LineSegment,
    sectorSegments: { id: string; seg: LineSegment }[],
    isSameStartFinish: boolean,
    startLineId: string,
    finishLineId: string
): DistanceResult[] {
    const distances: DistanceResult[] = [];

    const startDist = distancePointToSegmentMeters(currentPoint, startSegment.start, startSegment.end);
    distances.push({
        id: startLineId,
        label: isSameStartFinish ? 'START/FINISH' : 'START',
        distance: startDist
    });

    sectorSegments.forEach(sec => {
        const d = distancePointToSegmentMeters(currentPoint, sec.seg.start, sec.seg.end);
        distances.push({id: sec.id, label: sec.id.toUpperCase(), distance: d});
    });

    if (!isSameStartFinish) {
        const finishDist = distancePointToSegmentMeters(currentPoint, finishSegment.start, finishSegment.end);
        distances.push({id: finishLineId, label: 'FINISH', distance: finishDist});
    }

    return distances;
}

/**
 * Update arming states for all timing lines based on distance
 * A line is armed when the vehicle is far enough away (prevents re-triggering)
 *
 * @param rearmDistance - Minimum distance (meters) required to re-arm a line
 */
export function updateLineArmingStates(
    currentPoint: Point,
    startSegment: LineSegment,
    finishSegment: LineSegment,
    sectorSegments: { id: string; seg: LineSegment }[],
    isSameStartFinish: boolean,
    startArmedRef: { current: boolean },
    finishArmedRef: { current: boolean },
    segmentArmedRef: { current: Record<string, boolean> },
    rearmDistance: number
) {
    const startDist = distancePointToSegmentMeters(currentPoint, startSegment.start, startSegment.end);
    if (!startArmedRef.current && startDist >= rearmDistance) {
        startArmedRef.current = true;
    }

    sectorSegments.forEach(sec => {
        const d = distancePointToSegmentMeters(currentPoint, sec.seg.start, sec.seg.end);
        if (!segmentArmedRef.current[sec.id] && d >= rearmDistance) {
            segmentArmedRef.current[sec.id] = true;
        }
    });

    if (!isSameStartFinish) {
        const finishDist = distancePointToSegmentMeters(currentPoint, finishSegment.start, finishSegment.end);
        if (!finishArmedRef.current && finishDist >= rearmDistance) {
            finishArmedRef.current = true;
        }
    } else if (!finishArmedRef.current && startDist >= rearmDistance) {
        finishArmedRef.current = true;
    }
}

/**
 * Check if start line was crossed between two GPS samples
 * Applies debouncing and arming logic
 *
 * @returns true if crossing was detected and processed
 */
export function checkStartLineCrossing(
    p1: Point,
    p2: Point,
    tPrev: number,
    tCur: number,
    startSegment: LineSegment,
    isSameStartFinish: boolean,
    startArmedRef: { current: boolean },
    finishArmedRef: { current: boolean },
    lastStartCrossRef: { current: number },
    startLapCallback: ((t: number) => void) | null,
    debounceMs: number
): boolean {
    if (!startArmedRef.current) return false;

    const crossingMs = calculateCrossingTime(tPrev, tCur, p1, p2, startSegment.start, startSegment.end);
    if (crossingMs === null) return false;

    if (crossingMs - lastStartCrossRef.current > debounceMs) {
        lastStartCrossRef.current = crossingMs;
        startArmedRef.current = false;
        startLapCallback?.(crossingMs);
        if (isSameStartFinish) finishArmedRef.current = false;
        return true;
    }
    return false;
}

/**
 * Check if finish line was crossed between two GPS samples
 */
export function checkFinishLineCrossing(
    p1: Point,
    p2: Point,
    tPrev: number,
    tCur: number,
    finishSegment: LineSegment,
    finishArmedRef: { current: boolean },
    lastFinishCrossRef: { current: number },
    finishLapCallback: ((t: number) => void) | null,
    debounceMs: number
): boolean {
    if (!finishArmedRef.current) return false;

    const crossingMs = calculateCrossingTime(tPrev, tCur, p1, p2, finishSegment.start, finishSegment.end);
    if (crossingMs === null) return false;

    if (crossingMs - lastFinishCrossRef.current > debounceMs) {
        lastFinishCrossRef.current = crossingMs;
        finishArmedRef.current = false;
        finishLapCallback?.(crossingMs);
        return true;
    }
    return false;
}

/**
 * Check all sector line crossings between two GPS samples
 */
export function checkSectorCrossings(
    p1: Point,
    p2: Point,
    tPrev: number,
    tCur: number,
    sectorSegments: { id: string; seg: LineSegment }[],
    segmentArmedRef: { current: Record<string, boolean> },
    lastSectorCrossTimesRef: { current: Record<string, number> },
    markSectorCallback: ((id: string, t: number) => void) | null,
    debounceMs: number
) {
    sectorSegments.forEach(sec => {
        if (!segmentArmedRef.current[sec.id]) return;

        const crossingMs = calculateCrossingTime(tPrev, tCur, p1, p2, sec.seg.start, sec.seg.end);
        if (crossingMs === null) return;

        const last = lastSectorCrossTimesRef.current[sec.id] || 0;
        if (crossingMs - last > debounceMs) {
            lastSectorCrossTimesRef.current[sec.id] = crossingMs;
            segmentArmedRef.current[sec.id] = false;
            markSectorCallback?.(sec.id, crossingMs);
        }
    });
}

