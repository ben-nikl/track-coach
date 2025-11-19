/**
 * Acceleration Detector
 *
 * Detects braking and acceleration using sensor fusion (accelerometer + gyroscope)
 * and GPS speed data for reliable detection of driving dynamics
 */

import {Accelerometer, Gyroscope} from 'expo-sensors';

export enum DrivingState {
    BRAKING = 'braking',      // Red
    ACCELERATING = 'accelerating', // Green
    COASTING = 'coasting',    // Blue
    UNKNOWN = 'unknown'
}

export interface AccelerationData {
    state: DrivingState;
    longitudinalG: number;  // Forward/backward G-force
    lateralG: number;       // Left/right G-force
    verticalG: number;      // Up/down G-force
    timestamp: number;
}

/**
 * Configuration for acceleration detection thresholds
 */
const CONFIG = {
    // G-force thresholds for state detection
    BRAKING_THRESHOLD: -0.15,      // Negative longitudinal G (deceleration)
    ACCELERATION_THRESHOLD: 0.12,   // Positive longitudinal G
    COASTING_DEADBAND: 0.08,       // Deadband to prevent flickering

    // Low-pass filter alpha (0-1, higher = less filtering)
    FILTER_ALPHA: 0.3,

    // Minimum speed change for validation (m/s per second)
    MIN_SPEED_CHANGE: 0.5,

    // Calibration for gravity compensation
    GRAVITY: 9.81,

    // Moving average window size
    SMOOTHING_WINDOW: 5,
};

/**
 * Vector3D for sensor data
 */
interface Vector3D {
    x: number;
    y: number;
    z: number;
}

/**
 * Acceleration Detector Class
 * Uses sensor fusion to detect braking and acceleration events
 */
export class AccelerationDetector {
    private accelSubscription: any = null;
    private gyroSubscription: any = null;

    // Raw sensor data
    private accelData: Vector3D = {x: 0, y: 0, z: 0};
    private gyroData: Vector3D = {x: 0, y: 0, z: 0};

    // Filtered data
    private filteredAccel: Vector3D = {x: 0, y: 0, z: 0};

    // Calibration offset (gravity component when stationary)
    private gravityOffset: Vector3D = {x: 0, y: 0, z: 0};
    private isCalibrated = false;

    // State tracking
    private currentState: DrivingState = DrivingState.UNKNOWN;
    private lastSpeed: number | null = null;
    private lastSpeedTimestamp: number | null = null;

    // Smoothing buffers
    private longitudinalBuffer: number[] = [];
    private lateralBuffer: number[] = [];

    private isActive = false;

    /**
     * Start sensor monitoring
     */
    async start(): Promise<boolean> {
        if (this.isActive) return true;

        try {
            // Set update intervals (100ms = 10Hz)
            Accelerometer.setUpdateInterval(100);
            Gyroscope.setUpdateInterval(100);

            // Subscribe to accelerometer
            this.accelSubscription = Accelerometer.addListener((data) => {
                this.accelData = data;
                this.processAccelerometer(data);
            });

            // Subscribe to gyroscope (for future enhancements)
            this.gyroSubscription = Gyroscope.addListener((data) => {
                this.gyroData = data;
            });

            this.isActive = true;

            // Auto-calibrate after 2 seconds
            setTimeout(() => this.calibrate(), 2000);

            return true;
        } catch (error) {
            console.error('Failed to start acceleration detector:', error);
            return false;
        }
    }

    /**
     * Stop sensor monitoring
     */
    stop() {
        if (this.accelSubscription) {
            this.accelSubscription.remove();
            this.accelSubscription = null;
        }
        if (this.gyroSubscription) {
            this.gyroSubscription.remove();
            this.gyroSubscription = null;
        }
        this.isActive = false;
    }

    /**
     * Get current acceleration data and driving state
     * @param currentSpeed - Current GPS speed in m/s (optional for validation)
     */
    getCurrentAcceleration(currentSpeed?: number): AccelerationData {
        if (!this.isCalibrated) {
            return {
                state: DrivingState.UNKNOWN,
                longitudinalG: 0,
                lateralG: 0,
                verticalG: 0,
                timestamp: Date.now(),
            };
        }

        // Remove gravity offset to get linear acceleration
        const linearAccel = {
            x: this.filteredAccel.x - this.gravityOffset.x,
            y: this.filteredAccel.y - this.gravityOffset.y,
            z: this.filteredAccel.z - this.gravityOffset.z,
        };

        // Map device orientation to vehicle dynamics
        // Assuming phone is in landscape with top facing forward:
        // Y-axis = longitudinal (forward/back)
        // X-axis = lateral (left/right)
        // Z-axis = vertical (up/down)
        const longitudinalG = -linearAccel.y; // Negative because of coordinate system
        const lateralG = linearAccel.x;
        const verticalG = linearAccel.z;

        // Add to smoothing buffer
        this.longitudinalBuffer.push(longitudinalG);
        if (this.longitudinalBuffer.length > CONFIG.SMOOTHING_WINDOW) {
            this.longitudinalBuffer.shift();
        }

        this.lateralBuffer.push(lateralG);
        if (this.lateralBuffer.length > CONFIG.SMOOTHING_WINDOW) {
            this.lateralBuffer.shift();
        }

        // Calculate moving average
        const avgLongitudinal = this.longitudinalBuffer.reduce((a, b) => a + b, 0) / this.longitudinalBuffer.length;
        const avgLateral = this.lateralBuffer.reduce((a, b) => a + b, 0) / this.lateralBuffer.length;

        // Determine driving state with hysteresis
        let state = this.currentState;

        if (avgLongitudinal < CONFIG.BRAKING_THRESHOLD) {
            state = DrivingState.BRAKING;
        } else if (avgLongitudinal > CONFIG.ACCELERATION_THRESHOLD) {
            state = DrivingState.ACCELERATING;
        } else if (Math.abs(avgLongitudinal) < CONFIG.COASTING_DEADBAND) {
            state = DrivingState.COASTING;
        }

        // Validate with GPS speed if available
        if (currentSpeed !== undefined && this.lastSpeed !== null && this.lastSpeedTimestamp !== null) {
            const now = Date.now();
            const timeDelta = (now - this.lastSpeedTimestamp) / 1000; // seconds

            if (timeDelta > 0.05) { // Minimum 50ms between updates
                const speedChange = (currentSpeed - this.lastSpeed) / timeDelta; // m/s²

                // Cross-validate: if speed is decreasing but accel shows acceleration, trust GPS
                if (speedChange < -CONFIG.MIN_SPEED_CHANGE && state === DrivingState.ACCELERATING) {
                    state = DrivingState.BRAKING;
                } else if (speedChange > CONFIG.MIN_SPEED_CHANGE && state === DrivingState.BRAKING) {
                    state = DrivingState.ACCELERATING;
                }
            }
        }

        // Update tracking
        this.currentState = state;
        if (currentSpeed !== undefined) {
            this.lastSpeed = currentSpeed;
            this.lastSpeedTimestamp = Date.now();
        }

        return {
            state,
            longitudinalG: avgLongitudinal,
            lateralG: avgLateral,
            verticalG,
            timestamp: Date.now(),
        };
    }

    /**
     * Manual recalibration (call when car is stationary)
     */
    recalibrate() {
        this.calibrate();
    }

    /**
     * Get current state
     */
    getState(): DrivingState {
        return this.currentState;
    }

    /**
     * Check if detector is active and calibrated
     */
    isReady(): boolean {
        return this.isActive && this.isCalibrated;
    }

    /**
     * Calibrate gravity offset when device is stationary
     */
    private calibrate() {
        this.gravityOffset = {...this.accelData};
        this.isCalibrated = true;
        console.log('Acceleration detector calibrated:', this.gravityOffset);
    }

    /**
     * Process accelerometer data with low-pass filter
     */
    private processAccelerometer(data: Vector3D) {
        const alpha = CONFIG.FILTER_ALPHA;

        // Low-pass filter to reduce noise
        this.filteredAccel.x = alpha * data.x + (1 - alpha) * this.filteredAccel.x;
        this.filteredAccel.y = alpha * data.y + (1 - alpha) * this.filteredAccel.y;
        this.filteredAccel.z = alpha * data.z + (1 - alpha) * this.filteredAccel.z;
    }
}

