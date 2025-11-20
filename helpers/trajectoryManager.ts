/**
 * Trajectory Manager
 *
 * Manages GPS trajectory recording during laps
 * OPTIMIZED: Records only state transition points instead of all GPS samples
 * Reduces storage from ~1000 points to ~20-50 transition points per lap
 */

import {DrivingStateChange, TrajectoryPoint} from './lapSessionTypes';

/**
 * Storage for lap trajectories indexed by lap number
 */
export class TrajectoryManager {
    private trajectories: Map<number, TrajectoryPoint[]> = new Map();
    private drivingStateChanges: Map<number, DrivingStateChange[]> = new Map();
    private currentLapPoints: TrajectoryPoint[] = [];
    private currentStateChanges: DrivingStateChange[] = [];

    // Track last state to detect transitions
    private lastDrivingState: 'braking' | 'accelerating' | 'coasting' | 'unknown' | null = null;
    private lapStartRecorded: boolean = false;

    /**
     * Add a point to the current lap trajectory
     * OPTIMIZED: Only stores point if driving state changed
     */
    addPoint(point: TrajectoryPoint) {
        // Legacy: still store all points for backward compatibility
        this.currentLapPoints.push(point);

        // Optimized: detect state changes
        const currentState = point.drivingState || 'unknown';

        // Record lap start point
        if (!this.lapStartRecorded) {
            this.currentStateChanges.push({
                latitude: point.latitude,
                longitude: point.longitude,
                timestamp: point.timestamp,
                speed: point.speed || 0,
                state: currentState,
                changeType: 'lap_start',
                longitudinalG: point.longitudinalG,
                lateralG: point.lateralG,
            });
            this.lapStartRecorded = true;
            this.lastDrivingState = currentState;
            return;
        }

        // Detect state transition
        if (this.lastDrivingState !== null && currentState !== this.lastDrivingState) {
            this.currentStateChanges.push({
                latitude: point.latitude,
                longitude: point.longitude,
                timestamp: point.timestamp,
                speed: point.speed || 0,
                state: currentState,
                changeType: 'state_change',
                longitudinalG: point.longitudinalG,
                lateralG: point.lateralG,
            });
        }

        this.lastDrivingState = currentState;
    }

    /**
     * Finish the current lap and store its trajectory
     * @param lapIndex - The lap number to associate with this trajectory
     */
    finishLap(lapIndex: number): TrajectoryPoint[] {
        // Record lap end point
        if (this.currentLapPoints.length > 0) {
            const lastPoint = this.currentLapPoints[this.currentLapPoints.length - 1];
            this.currentStateChanges.push({
                latitude: lastPoint.latitude,
                longitude: lastPoint.longitude,
                timestamp: lastPoint.timestamp,
                speed: lastPoint.speed || 0,
                state: lastPoint.drivingState || 'unknown',
                changeType: 'lap_end',
                longitudinalG: lastPoint.longitudinalG,
                lateralG: lastPoint.lateralG,
            });
        }

        const points = [...this.currentLapPoints];
        const stateChanges = [...this.currentStateChanges];

        this.trajectories.set(lapIndex, points);
        this.drivingStateChanges.set(lapIndex, stateChanges);

        // Reset for next lap
        this.currentLapPoints = [];
        this.currentStateChanges = [];
        this.lastDrivingState = null;
        this.lapStartRecorded = false;

        return points;
    }

    /**
     * Get optimized state changes for a specific lap
     * Returns only transition points (20-50 points instead of 1000)
     */
    getStateChanges(lapIndex: number): DrivingStateChange[] | undefined {
        return this.drivingStateChanges.get(lapIndex);
    }

    /**
     * Get trajectory for a specific lap (legacy - returns all points)
     */
    getTrajectory(lapIndex: number): TrajectoryPoint[] | undefined {
        return this.trajectories.get(lapIndex);
    }

    /**
     * Get all recorded trajectories
     */
    getAllTrajectories(): Map<number, TrajectoryPoint[]> {
        return this.trajectories;
    }

    /**
     * Get all state changes (optimized data)
     */
    getAllStateChanges(): Map<number, DrivingStateChange[]> {
        return this.drivingStateChanges;
    }

    /**
     * Clear current lap trajectory (e.g., when session ends without finishing lap)
     */
    clearCurrentLap() {
        this.currentLapPoints = [];
        this.currentStateChanges = [];
        this.lastDrivingState = null;
        this.lapStartRecorded = false;
    }

    /**
     * Reset all stored trajectories
     */
    reset() {
        this.trajectories.clear();
        this.drivingStateChanges.clear();
        this.clearCurrentLap();
    }

    /**
     * Clear all data (alias for reset)
     */
    clearAll() {
        this.reset();
    }
}
