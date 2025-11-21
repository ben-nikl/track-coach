/**
 * Mock Location Provider - GPS Track Playback System
 *
 * Simuluje GPS pozice z přednahraných tratí pro testování na reálném zařízení.
 * Umožňuje testovat lap timing systém bez nutnosti být fyzicky na trati.
 */

import * as Location from 'expo-location';

export interface MockTrackPoint {
    latitude: number;
    longitude: number;
    timestamp: number; // relative ms from track start
    speed: number; // m/s
    accuracy: number; // meters
    altitude?: number;
    heading?: number;
}

export interface MockTrack {
    trackName: string;
    trackId: string;
    description?: string;
    points: MockTrackPoint[];
    duration: number; // total duration in ms
}

export interface MockLocationConfig {
    track: MockTrack;
    playbackSpeed: number; // 1.0 = realtime, 2.0 = 2x faster, 0.5 = half speed
    loop: boolean; // restart from beginning when finished
    autoStart: boolean;
}

export type MockLocationCallback = (location: Location.LocationObject) => void;

/**
 * Mock Location Provider - simuluje GPS pozice z přednahrané trati
 */
export class MockLocationProvider {
    private config: MockLocationConfig | null = null;
    private isPlaying: boolean = false;
    private isPaused: boolean = false;
    private startTime: number = 0;
    private pausedAt: number = 0;
    private pausedDuration: number = 0;
    private intervalId: NodeJS.Timeout | null = null;
    private subscribers: Set<MockLocationCallback> = new Set();
    private currentPointIndex: number = 0;
    private trackSource: string = ''; // NEW: Track source identifier

    /**
     * Načte a inicializuje mock track
     */
    public loadTrack(config: MockLocationConfig, source?: string): void {
        this.stop();
        this.config = config;
        this.currentPointIndex = 0;
        this.trackSource = source || 'unknown';

        console.log('🔧 MOCK GPS: Loaded track:', {
            trackName: config.track.trackName,
            trackId: config.track.trackId,
            source: this.trackSource,
            points: config.track.points.length,
            duration: `${(config.track.duration / 1000).toFixed(1)}s`,
            playbackSpeed: config.playbackSpeed,
            loop: config.loop,
            autoStart: config.autoStart,
        });

        if (config.autoStart) {
            this.start();
        }
    }

    /**
     * Vrátí informace o zdroji dat pro debugging
     */
    public getDebugInfo(): {
        trackName: string;
        trackId: string;
        source: string;
        isActive: boolean;
        currentPoint: number;
        totalPoints: number;
        progress: number;
    } | null {
        if (!this.config) return null;

        return {
            trackName: this.config.track.trackName,
            trackId: this.config.track.trackId,
            source: this.trackSource,
            isActive: this.isPlaying && !this.isPaused,
            currentPoint: this.currentPointIndex,
            totalPoints: this.config.track.points.length,
            progress: this.getProgress(),
        };
    }

    /**
     * Spustí přehrávání trati
     */
    public start(): void {
        if (!this.config) {
            throw new Error('No track loaded. Call loadTrack() first.');
        }

        if (this.isPlaying && !this.isPaused) {
            return; // already playing
        }

        if (this.isPaused) {
            // Resume from pause
            this.pausedDuration += Date.now() - this.pausedAt;
            this.isPaused = false;
        } else {
            // Fresh start
            this.startTime = Date.now();
            this.pausedDuration = 0;
            this.currentPointIndex = 0;
        }

        this.isPlaying = true;
        console.log('🔧 MOCK GPS STARTED');
        this.scheduleNextUpdate();
    }

    /**
     * Pozastaví přehrávání
     */
    public pause(): void {
        if (!this.isPlaying || this.isPaused) return;

        this.isPaused = true;
        this.pausedAt = Date.now();

        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Zastaví přehrávání a resetuje na začátek
     */
    public stop(): void {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPointIndex = 0;
        this.pausedDuration = 0;

        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Restartuje přehrávání od začátku
     */
    public restart(): void {
        this.stop();

        console.log('🔧 MOCK GPS STOPPED');
        this.start();
    }

    /**
     * Přeskočí na konkrétní pozici v trati (0.0 - 1.0)
     */
    public seek(progress: number): void {
        if (!this.config) return;

        const clampedProgress = Math.max(0, Math.min(1, progress));
        const targetTime = this.config.track.duration * clampedProgress;

        // Najdi nejbližší bod
        const pointIndex = this.findPointIndexAtTime(targetTime);
        this.currentPointIndex = pointIndex;

        // Reset timingu
        this.startTime = Date.now() - (targetTime / this.config.playbackSpeed);
        this.pausedDuration = 0;
    }

    /**
     * Vrátí aktuální progres přehrávání (0.0 - 1.0)
     */
    public getProgress(): number {
        if (!this.config || !this.isPlaying) return 0;

        const elapsed = this.getElapsedTime();
        return Math.min(1, elapsed / this.config.track.duration);
    }

    /**
     * Přidá subscriber pro location updates
     */
    public addSubscriber(callback: MockLocationCallback): void {
        this.subscribers.add(callback);
    }

    /**
     * Odebere subscriber
     */
    public removeSubscriber(callback: MockLocationCallback): void {
        this.subscribers.delete(callback);
    }

    /**
     * Kontroluje, zda je provider aktivní
     */
    public isActive(): boolean {
        return this.isPlaying && !this.isPaused;
    }

    /**
     * Vrátí aktuální konfiguraci
     */
    public getConfig(): MockLocationConfig | null {
        return this.config;
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private scheduleNextUpdate(): void {
        if (!this.config || !this.isPlaying || this.isPaused) return;

        const elapsed = this.getElapsedTime();
        const nextPoint = this.getNextPoint(elapsed);

        if (nextPoint) {
            // Emit current location
            this.emitLocation(nextPoint);

            // Calculate delay to next point
            const nextElapsed = nextPoint.timestamp;
            const realTimeDelay = (nextElapsed - elapsed) / this.config.playbackSpeed;

            this.intervalId = setTimeout(() => {
                this.scheduleNextUpdate();
            }, Math.max(16, realTimeDelay)); // minimum 16ms (60 FPS)

        } else {
            // Track finished
            if (this.config.loop) {
                this.restart();
            } else {
                this.stop();
            }
        }
    }

    private getElapsedTime(): number {
        if (!this.isPlaying) return 0;

        const now = Date.now();
        const realElapsed = now - this.startTime - this.pausedDuration;
        return realElapsed * (this.config?.playbackSpeed || 1);
    }

    private getNextPoint(elapsedMs: number): MockTrackPoint | null {
        if (!this.config) return null;

        const points = this.config.track.points;

        // Find next point after current elapsed time
        for (let i = this.currentPointIndex; i < points.length; i++) {
            if (points[i].timestamp >= elapsedMs) {
                this.currentPointIndex = i;
                return points[i];
            }
        }

        return null; // track finished
    }

    private findPointIndexAtTime(targetTime: number): number {
        if (!this.config) return 0;

        const points = this.config.track.points;

        for (let i = 0; i < points.length; i++) {
            if (points[i].timestamp >= targetTime) {
                return i;
            }
        }

        return points.length - 1;
    }

    private emitLocation(point: MockTrackPoint): void {
        const location: Location.LocationObject = {
            coords: {
                latitude: point.latitude,
                longitude: point.longitude,
                altitude: point.altitude || 0,
                accuracy: point.accuracy,
                altitudeAccuracy: point.accuracy,
                heading: point.heading || 0,
                speed: point.speed,
            },
            timestamp: Date.now(),
        };

        // Log mock GPS data emission for debugging
        if (this.currentPointIndex % 10 === 0) { // Log every 10th point to avoid spam
            console.log(`🔧 MOCK GPS: Point ${this.currentPointIndex}/${this.config?.track.points.length} - Lat: ${point.latitude.toFixed(6)}, Lng: ${point.longitude.toFixed(6)}, Speed: ${point.speed.toFixed(1)} m/s`);
        }

        // Notify all subscribers
        this.subscribers.forEach(callback => {
            try {
                callback(location);
            } catch (error) {
                console.error('Error in mock location subscriber:', error);
            }
        });
    }
}

// Singleton instance
let mockLocationProviderInstance: MockLocationProvider | null = null;

/**
 * Vrátí singleton instanci MockLocationProvider
 */
export function getMockLocationProvider(): MockLocationProvider {
    if (!mockLocationProviderInstance) {
        mockLocationProviderInstance = new MockLocationProvider();
    }
    return mockLocationProviderInstance;
}
