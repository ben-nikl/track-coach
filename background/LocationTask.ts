import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const LOCATION_TASK_NAME = 'TRACK_COACH_LOCATION';

// Buffered locations received before a subscriber attaches
let pending: Location.LocationObject[] = [];
let subscriber: ((loc: Location.LocationObject) => void) | null = null;

export function attachLocationSubscriber(fn: (loc: Location.LocationObject) => void) {
    subscriber = fn;
    if (pending.length) {
        pending.forEach(l => subscriber && subscriber(l));
        pending = [];
    }
}

export function detachLocationSubscriber() {
    subscriber = null;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({data, error}) => {
    if (error) {
        console.warn('Background location task error', error);
        return;
    }
    const {locations} = data as { locations: Location.LocationObject[] };
    locations.forEach(loc => {
        if (subscriber) subscriber(loc); else pending.push(loc);
    });
    // Explicit resolve for type compliance
    return null;
});

export async function ensureBackgroundUpdates() {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (started) return true;
    try {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 0,
            timeInterval: 0,
            // iOS only indicator
            showsBackgroundLocationIndicator: true,
            // Android foreground service notification
            foregroundService: {
                notificationTitle: 'Track Coach',
                notificationBody: 'Lap timing active',
                killServiceOnDestroy: false,
            },
            pausesUpdatesAutomatically: false,
        });
        return true;
    } catch (e) {
        console.warn('Failed to start background updates', e);
        return false;
    }
}

export async function stopBackgroundUpdates() {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!started) return;
    try {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
    }
}
