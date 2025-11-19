/**
 * Trajectory Manager
 *
 * Manages GPS trajectory recording during laps
 * Stores trajectory points for each lap to enable replay/visualization
 */

import {TrajectoryPoint} from './lapSessionTypes';

/**
 * Storage for lap trajectories indexed by lap number
 */
export class TrajectoryManager {
    private trajectories: Map<number, TrajectoryPoint[]> = new Map();
    private currentLapPoints: TrajectoryPoint[] = [];

    /**
     * Add a point to the current lap trajectory
     */
    addPoint(point: TrajectoryPoint) {
        this.currentLapPoints.push(point);
    }

    /**
     * Finish the current lap and store its trajectory
     * @param lapIndex - The lap number to associate with this trajectory
     */
    finishLap(lapIndex: number): TrajectoryPoint[] {
        const points = [...this.currentLapPoints];
        this.trajectories.set(lapIndex, points);
        this.currentLapPoints = [];
        return points;
    }

    /**
     * Get trajectory for a specific lap
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
     * Clear current lap trajectory (e.g., when session ends without finishing lap)
     */
    clearCurrentLap() {
        this.currentLapPoints = [];
    }

    /**
     * Clear all stored trajectories
     */
    clearAll() {
        this.trajectories.clear();
        this.currentLapPoints = [];
    }

    /**
     * Get current lap point count (for debugging)
     */
    getCurrentPointCount(): number {
        return this.currentLapPoints.length;
    }
}

