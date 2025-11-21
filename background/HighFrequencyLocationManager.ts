import * as Location from 'expo-location';
import {Accelerometer, DeviceMotion, Gyroscope} from 'expo-sensors';
import {Subscription} from 'expo-sensors/build/DeviceSensor';
import {LatLng} from '../helpers/generatePerpendicularSectors';
import {projectToLocal} from '../helpers/geo';

/** Fused high-frequency location sample */
export interface FusedSample {
    timestamp: number; // ms epoch
    latitude: number;
    longitude: number;
    speedMps: number;
    accuracy?: number; // from GPS when source === 'gps'
    source: 'fused' | 'gps';
}

interface DeadReckoningState {
    x: number; // meters east of anchor
    y: number; // meters north of anchor
    vx: number; // m/s east
    vy: number; // m/s north
    lastTimestamp: number; // ms
}

/**
 * HighFrequencyLocationManager
 * - GPS (1Hz) used as anchor & drift correction
 * - IMU (100Hz) integrated for dead reckoning
 * - Simple complementary fusion: position = deadReckoned + gradual GPS correction
 */
export class HighFrequencyLocationManager {
    // Earth radius meters
    private static readonly R = 6371000;
    private gpsWatch: Location.LocationSubscription | null = null;
    private accelSub: Subscription | null = null;
    private gyroSub: Subscription | null = null;
    private motionSub: Subscription | null = null;
    private anchor: LatLng | null = null;
    private dr: DeadReckoningState | null = null;
    // Pending correction vector (meters) applied gradually after each GPS update
    private correctionX = 0;
    private correctionY = 0;
    // How fast to bleed in correction each tick (0..1). 0.02 => ~50 ticks for full correction
    private readonly correctionAlpha = 0.02;
    // Low-pass blend for speed using GPS speed vs integrated speed
    private readonly speedBlendAlpha = 0.1; // fraction of GPS speed injected per GPS update
    private listeners: Set<(s: FusedSample) => void> = new Set();
    private running = false;
    /** Estimate speed from previous GPS fix if speed missing */
    private prevGps: { t: number; lat: number; lon: number } | null = null;
    /** Flag to indicate if mock GPS mode is active (disables real GPS watch) */
    private mockGpsMode = false;

    /** Request permissions and start sensors */
    async start(): Promise<boolean> {
        if (this.running) return true;
        try {
            const {status} = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return false;
            // Background permission attempt (ignore failure for MVP)
            await Location.requestBackgroundPermissionsAsync().catch(() => {
            });

            // Watch GPS at ~1Hz (timeInterval 1000ms). distanceInterval 0 for continuous.
            this.gpsWatch = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 1000,
                    distanceInterval: 0,
                    mayShowUserSettingsDialog: true,
                },
                (loc) => this.onGps(loc)
            );

            // Configure sensor update intervals (~100Hz => 10ms). JS may downgrade to ~50-60Hz.
            try {
                Accelerometer.setUpdateInterval(10);
                Gyroscope.setUpdateInterval(10);
                DeviceMotion.setUpdateInterval(10);
            } catch {
            }

            // Subscribe accelerometer (m/s^2). Expo returns in G? Docs: returns acceleration including gravity (G) for some sensors.
            // We prefer DeviceMotion.userAcceleration but keep accelerometer as fallback.
            this.motionSub = DeviceMotion.addListener((data) => {
                // Some platforms expose userAcceleration; not typed in expo-sensors types, cast to any.
                const anyData: any = data;
                const a = anyData.userAcceleration; // may be undefined
                if (a && typeof a.x === 'number') {
                    this.onImuAcceleration(a.x || 0, a.y || 0, a.z || 0, Date.now());
                } else if (data.acceleration) {
                    // acceleration includes gravity; skipping for MVP to avoid drift.
                }
            });

            // Optionally also gyro (not fully used yet but could refine heading)
            this.gyroSub = Gyroscope.addListener(() => {
                // Reserved for future orientation compensation (e.g., heading drift). Not used in MVP complementary approach.
            });

            // Fallback: accelerometer if DeviceMotion not giving userAcceleration
            this.accelSub = Accelerometer.addListener((accel) => {
                // Values may be in G (approx). Expo docs: Accelerometer returns in G. Convert to m/s^2.
                const g = 9.80665;
                this.onImuAcceleration(accel.x * g, accel.y * g, accel.z * g, Date.now());
            });

            this.running = true;
            return true;
        } catch (e) {
            console.warn('HighFrequencyLocationManager start failed', e);
            return false;
        }
    }

    /** Stop all updates */
    stop() {
        this.gpsWatch?.remove();
        this.gpsWatch = null;
        this.accelSub?.remove();
        this.accelSub = null;
        this.gyroSub?.remove();
        this.gyroSub = null;
        this.motionSub?.remove();
        this.motionSub = null;
        this.running = false;
    }

    /** Subscribe to fused samples (approx 50-100Hz) */
    subscribe(fn: (s: FusedSample) => void) {
        this.listeners.add(fn);
    }

    unsubscribe(fn: (s: FusedSample) => void) {
        this.listeners.delete(fn);
    }

    /** Start in mock GPS mode - sensors only, no real GPS watch */
    async startMockMode(): Promise<boolean> {
        if (this.running) return true;
        this.mockGpsMode = true;

        try {
            // Configure sensor update intervals (~100Hz => 10ms)
            try {
                Accelerometer.setUpdateInterval(10);
                Gyroscope.setUpdateInterval(10);
                DeviceMotion.setUpdateInterval(10);
            } catch {
            }

            // Subscribe to IMU sensors (same as normal mode)
            this.motionSub = DeviceMotion.addListener((data) => {
                const anyData: any = data;
                const a = anyData.userAcceleration;
                if (a && typeof a.x === 'number') {
                    this.onImuAcceleration(a.x || 0, a.y || 0, a.z || 0, Date.now());
                }
            });

            this.gyroSub = Gyroscope.addListener(() => {
                // Reserved for future use
            });

            const g = 9.80665;
            this.accelSub = Accelerometer.addListener((accel) => {
                this.onImuAcceleration(accel.x * g, accel.y * g, accel.z * g, Date.now());
            });

            this.running = true;
            console.log('🔧 HighFrequencyLocationManager started in MOCK GPS mode');
            return true;
        } catch (e) {
            console.warn('HighFrequencyLocationManager mock mode start failed', e);
            return false;
        }
    }

    /**
     * Inject mock GPS update (used when mock GPS is active)
     * This replaces the onGps callback with externally provided location data
     */
    injectMockGpsUpdate(loc: Location.LocationObject): void {
        if (!this.mockGpsMode) {
            console.warn('injectMockGpsUpdate called but not in mock mode');
            return;
        }
        this.onGps(loc);
    }

    private emit(sample: FusedSample) {
        this.listeners.forEach((l) => l(sample));
    }

    private onGps(loc: Location.LocationObject) {
        const timestamp: number = loc.timestamp as number; // expo-location provides number (ms)
        const {latitude, longitude} = loc.coords;
        const gpsSpeed = loc.coords.speed ?? this.estimateGpsSpeed(timestamp, latitude, longitude);

        if (!this.anchor) {
            // Initialize anchor & state
            this.anchor = {latitude, longitude};
            this.dr = {x: 0, y: 0, vx: gpsSpeed || 0, vy: 0, lastTimestamp: timestamp};
            this.emit({
                timestamp,
                latitude,
                longitude,
                speedMps: gpsSpeed || 0,
                accuracy: loc.coords.accuracy ?? undefined,
                source: 'gps'
            });
            return;
        }
        if (!this.dr) return; // should not happen

        // Project GPS to local tangent plane of current anchor
        const local = projectToLocal(this.anchor, {latitude, longitude});

        // Current dead-reckoned position (before correction)
        const dxErr = local.x - this.dr.x;
        const dyErr = local.y - this.dr.y;

        // Set pending correction (overwrite). Large errors will be applied gradually.
        this.correctionX = dxErr;
        this.correctionY = dyErr;

        // Blend speed: inject fraction of gps speed into integrated velocity magnitude
        if (gpsSpeed != null) {
            const currentSpeed = Math.hypot(this.dr.vx, this.dr.vy);
            const blended = (1 - this.speedBlendAlpha) * currentSpeed + this.speedBlendAlpha * gpsSpeed;
            if (currentSpeed > 1e-3) {
                const scale = blended / currentSpeed;
                this.dr.vx *= scale;
                this.dr.vy *= scale;
            } else {
                // initialize along east axis for lack of bearing
                this.dr.vx = blended;
                this.dr.vy = 0;
            }
        }

        // Optionally shift anchor occasionally to reduce floating error if far (>500m)
        const distFromAnchor = Math.hypot(local.x, local.y);
        if (distFromAnchor > 500) {
            // Re-anchor: Convert current dead-reckoned state to lat/lon, set new anchor = GPS fix, reset x,y to local coords
            this.anchor = {latitude, longitude};
            this.dr.x = 0;
            this.dr.y = 0;
            this.correctionX = 0;
            this.correctionY = 0;
        }

        // Emit GPS sample as authoritative
        this.emit({
            timestamp,
            latitude,
            longitude,
            speedMps: gpsSpeed ?? Math.hypot(this.dr.vx, this.dr.vy),
            accuracy: loc.coords.accuracy ?? undefined,
            source: 'gps'
        });
    }

    private estimateGpsSpeed(t: number, lat: number, lon: number): number | null {
        if (!this.prevGps) {
            this.prevGps = {t, lat, lon};
            return null;
        }
        const dt = (t - this.prevGps.t) / 1000;
        if (dt <= 0.2) return null; // ignore unrealistic
        const d = this.haversine(this.prevGps.lat, this.prevGps.lon, lat, lon);
        this.prevGps = {t, lat, lon};
        return d / dt;
    }

    private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return HighFrequencyLocationManager.R * c;
    }

    /** Handle IMU acceleration samples (m/s^2). We treat device X axis as forward-east approximation. */
    private onImuAcceleration(ax: number, _ay: number, _az: number, timestamp: number) {
        if (!this.dr || !this.anchor) return;

        // Limit dt to reasonable range (handle dropped frames)
        let dt = (timestamp - this.dr.lastTimestamp) / 1000;
        if (dt <= 0 || dt > 0.2) dt = 0.02; // fallback typical 50Hz
        this.dr.lastTimestamp = timestamp;

        // Simplified mapping: assume phone aligned so that:
        //  ax ~ forward (we'll map to velocity direction), ay ~ lateral, az ~ vertical (ignored)
        // If moving, project acceleration along current velocity direction to reduce noise.
        let vx = this.dr.vx;
        let vy = this.dr.vy;
        const speed = Math.hypot(vx, vy);
        let axWorld: number;
        let ayWorld: number;
        if (speed > 0.5) {
            // Direction unit
            const ux = vx / speed;
            const uy = vy / speed;
            // Project forward accel magnitude using device ax as forward estimate
            axWorld = ax * ux;
            ayWorld = ax * uy; // same magnitude along direction
        } else {
            // When near stopped, we can't know heading; ignore acceleration until GPS gives motion direction.
            axWorld = 0;
            ayWorld = 0;
        }

        // Integrate velocity
        this.dr.vx += axWorld * dt;
        this.dr.vy += ayWorld * dt;

        // Integrate position (using updated velocity; semi-implicit Euler)
        this.dr.x += this.dr.vx * dt;
        this.dr.y += this.dr.vy * dt;

        // Apply small fraction of pending correction
        if (Math.abs(this.correctionX) > 0.001 || Math.abs(this.correctionY) > 0.001) {
            const applyX = this.correctionAlpha * this.correctionX;
            const applyY = this.correctionAlpha * this.correctionY;
            this.dr.x += applyX;
            this.dr.y += applyY;
            this.correctionX -= applyX;
            this.correctionY -= applyY;
        }

        // Convert local (x,y) back to lat/lon
        const lat = this.anchor.latitude + (this.dr.y / HighFrequencyLocationManager.R) * (180 / Math.PI);
        const lon = this.anchor.longitude + (this.dr.x / (HighFrequencyLocationManager.R * Math.cos((this.anchor.latitude * Math.PI) / 180))) * (180 / Math.PI);

        this.emit({
            timestamp,
            latitude: lat,
            longitude: lon,
            speedMps: Math.hypot(this.dr.vx, this.dr.vy),
            source: 'fused'
        });
    }
}

// Singleton (optional convenience)
export const highFrequencyLocationManager = new HighFrequencyLocationManager();
