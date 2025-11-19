# Lap Timing System - Technical Documentation

## Overview

The Track Coach lap timing system is a high-precision GPS-based lap timer designed for racing tracks. It uses advanced
techniques to accurately detect when a vehicle crosses virtual timing lines (start, finish, and sector lines) and
records complete lap data including GPS trajectories.

## Architecture

### Core Components

1. **LapSessionContext** - Central state management for lap timing sessions
2. **Line Crossing Detection** - Algorithms for detecting timing line crossings
3. **Trajectory Manager** - Records and stores GPS paths for each lap
4. **High-Frequency Location Manager** - Processes fused GPS/IMU data at high frequency

### Data Flow

```
GPS/IMU Sensors (10-20Hz)
    ↓
High-Frequency Location Manager
    ↓
Fused Sample Handler
    ↓
Line Crossing Detection
    ↓
Lap Event Logging + Trajectory Recording
    ↓
LapSessionContext State
    ↓
UI Components (LapTimerScreen, TrackDetailScreen)
```

## Key Concepts

### 1. Timing Lines

Timing lines are virtual lines placed on the track that trigger timing events:

- **Start Line**: Begins a new lap
- **Sector Lines**: Intermediate timing points within a lap
- **Finish Line**: Ends a lap and records the final time

Each line is defined by:

- Center point (GPS coordinate)
- Two track reference points (define track direction)
- Half-width (typically 12 meters)

### 2. Line Arming

To prevent double-triggers, timing lines use an "arming" mechanism:

- A line must be **armed** before it can detect a crossing
- After a crossing is detected, the line is **disarmed**
- The line re-arms when the vehicle is at least `LINE_REARM_DISTANCE_M` (6m) away

### 3. Debouncing

Prevents multiple crossing detections in quick succession:

- **Start Line**: 1200ms debounce
- **Sector Lines**: 800ms debounce
- **Finish Line**: 800ms debounce

### 4. Crossing Interpolation

Since GPS updates arrive at discrete intervals (10-20Hz), the exact crossing time is calculated by:

1. Detecting if the path between two GPS samples intersects a timing line
2. Calculating the intersection parameter `t` (0 to 1) along the path
3. Interpolating the timestamp: `crossingTime = prevTime + t * (curTime - prevTime)`

This provides sub-100ms accuracy even with 10Hz GPS data.

### 5. Trajectory Recording

During each lap, all GPS points are recorded with:

- Latitude/Longitude
- Timestamp
- Speed (if available)
- Accuracy estimate

Trajectories are stored with lap records and can be replayed on the map.

## Module Documentation

### helpers/lineCrossing.ts

Core algorithms for detecting timing line crossings.

#### Functions

##### `calculateCrossingTime(tPrev, tCur, p1, p2, lineStart, lineEnd): number | null`

Calculates the exact time when a vehicle crossed a timing line.

**Parameters:**

- `tPrev` - Timestamp of previous GPS sample (ms)
- `tCur` - Timestamp of current GPS sample (ms)
- `p1` - Previous GPS position `{latitude, longitude}`
- `p2` - Current GPS position `{latitude, longitude}`
- `lineStart` - Start point of timing line
- `lineEnd` - End point of timing line

**Returns:** Interpolated crossing time in milliseconds, or `null` if no crossing occurred

**Algorithm:**

1. Check if line segment (p1→p2) intersects timing line using `segmentsIntersect()`
2. Calculate intersection parameter `t` using `intersectionParamT()`
3. Interpolate timestamp: `tPrev + t * (tCur - tPrev)`

---

#####

`computeLineDistances(currentPoint, startSegment, finishSegment, sectorSegments, isSameStartFinish, startLineId, finishLineId): DistanceResult[]`

Computes distances from current position to all timing lines.

**Returns:** Array of `{id, label, distance}` objects for each timing line

**Used for:**

- Displaying proximity to timing lines in UI
- Determining when to re-arm timing lines

---

#####

`updateLineArmingStates(currentPoint, startSegment, finishSegment, sectorSegments, isSameStartFinish, startArmedRef, finishArmedRef, segmentArmedRef, rearmDistance)`

Updates the armed state of all timing lines based on vehicle distance.

**Logic:**

- If line is disarmed AND distance >= `rearmDistance` (6m) → arm the line
- Operates on refs to avoid re-renders

---

##### `checkStartLineCrossing(...): boolean`

Checks if start line was crossed between two GPS samples.

**Returns:** `true` if crossing detected and processed

**Side effects:**

- Updates `lastStartCrossRef` timestamp
- Disarms start line
- Calls `startLapCallback(crossingTime)`
- If start/finish are same line, also disarms finish line

---

##### `checkFinishLineCrossing(...): boolean`

Checks if finish line was crossed between two GPS samples.

**Returns:** `true` if crossing detected and processed

**Side effects:**

- Updates `lastFinishCrossRef` timestamp
- Disarms finish line
- Calls `finishLapCallback(crossingTime)`

---

##### `checkSectorCrossings(...)`

Checks all sector lines for crossings.

**Logic:**

- Iterates through all sector segments
- For each armed sector, checks for crossing
- Applies debouncing
- Calls `markSectorCallback(sectorId, crossingTime)` when crossed

### helpers/trajectoryManager.ts

Manages GPS trajectory recording and storage.

#### Class: TrajectoryManager

##### `addPoint(point: TrajectoryPoint)`

Adds a GPS point to the current lap trajectory.

**Point structure:**

```typescript
{
    latitude: number;
    longitude: number;
    timestamp: number;
    speed ? : number;
    accuracy ? : number;
}
```

---

##### `finishLap(lapIndex: number): TrajectoryPoint[]`

Completes the current lap and stores its trajectory.

**Returns:** Array of trajectory points for the finished lap

**Side effects:**

- Stores trajectory in internal map: `Map<lapIndex, TrajectoryPoint[]>`
- Clears current lap points

---

##### `getTrajectory(lapIndex: number): TrajectoryPoint[] | undefined`

Retrieves stored trajectory for a specific lap.

---

##### `clearAll()`

Clears all stored trajectories (called when session ends).

---

##### `clearCurrentLap()`

Clears only the current lap trajectory (e.g., when lap is invalidated).

### helpers/lapSessionTypes.ts

Type definitions and constants for the lap timing system.

#### Configuration Constants

```typescript
LINE_HALF_WIDTH_M = 12        // Half-width of timing lines (meters)
REQUIRED_ACCURACY_M = 15      // Required GPS accuracy to process location
START_DEBOUNCE_MS = 1200      // Start line debounce time
SEGMENT_DEBOUNCE_MS = 800     // Sector line debounce time
FINISH_DEBOUNCE_MS = 800      // Finish line debounce time
LINE_REARM_DISTANCE_M = 6     // Distance to re-arm timing lines
```

#### Key Types

##### `LapEvent`

Represents a timing event (start/sector/finish).

```typescript
{
    id: string;
    type: 'start' | 'sector' | 'finish';
    lapIndex: number;
    sectorIndex ? : number;
    timestampMs: number;          // Interpolated crossing time
    wallClockISO: string;         // Wall clock timestamp
    lapElapsedMs ? : number;        // Time since lap start
    splitMs ? : number;             // Sector split time
}
```

##### `LapRecord`

Complete record of a finished lap.

```typescript
{
    lapIndex: number;
    lapTimeMs: number;            // Total lap time
    sectorSplitsMs: number[];     // Array of sector split times
    trajectoryPoints ? : TrajectoryPoint[]; // GPS trajectory
}
```

### components/LapSessionContext.tsx

Central React context for lap timing session management.

#### Context Value

The context provides:

**State:**

- `events: LapEvent[]` - Chronological list of all timing events
- `laps: LapRecord[]` - Completed lap records with trajectories
- `sessionActive: boolean` - Whether a timing session is active
- `trackData: Track | null` - Current track configuration
- `currentLapStartMs: number | null` - Start time of current lap
- `selectedLapIndex: number | null` - Currently selected lap for replay

**Computed Values:**

- `currentLapElapsedMs: number | null` - Current lap elapsed time (live)
- `lapNumber: number` - Current lap number
- `sectorBoxes: SectorBox[]` - Sector display state for UI
- `ghostLapMs: number` - Best lap time for comparison
- `lineDistances` - Distances to all timing lines

**Actions:**

- `startSession(track)` - Begin timing session for a track
- `endSession()` - End current timing session
- `resetSession()` - Clear all session data
- `setSelectedLapIndex(index)` - Select lap for trajectory view
- `getTrajectoryForLap(index)` - Get trajectory points for a lap

#### Key Internal Functions

##### `startLap(startTimeMs: number)`

Called when start line is crossed.

**Actions:**

1. Sets `currentLapStartMs` state
2. Clears sector timing array
3. Re-arms all sector lines
4. Clears current trajectory
5. Logs start event
6. Shows "Lap started" toast

---

##### `finishLap(finishTimeMs: number)`

Called when finish line is crossed.

**Actions:**

1. Calculates lap duration and final sector split
2. Stores trajectory with lap record
3. Logs finish event
4. Updates best lap time if applicable
5. Persists lap times to AsyncStorage
6. If start/finish are same line → auto-starts next lap
7. Shows "Lap finished" toast

---

##### `markSectorCrossing(sectorId: string, crossingTimeMs: number)`

Called when a sector line is crossed.

**Actions:**

1. Calculates sector split time
2. Adds to `sectorsTiming` array
3. Logs sector event
4. Shows sector split toast

---

##### `processFusedLike(tPrev, latPrev, lonPrev, tCur, latCur, lonCur)`

Main crossing detection logic, called for each high-frequency GPS update.

**Algorithm:**

1. Update line arming states based on current position
2. Compute distances to all timing lines
3. If lap not started → check start line crossing
4. If lap started → check finish line crossing
5. If finish not crossed → check sector crossings

**Prevents race conditions:**

- Uses `crossingLockRef` to prevent recursive calls
- Uses refs for callbacks to avoid stale closures

## UI Components

### LapTimerScreen

Main lap timing display during active session.

**Features:**

- Real-time lap timer with millisecond precision
- Sector split display with live timing
- **Dynamic info panel** that shows:
    - **Before lap starts:** Distance to start line (in meters)
    - **During lap:** Current lap elapsed time
    - **After finish (delta mode):** Time delta compared to best lap (or ghost lap if ghost mode active)
    - Delta mode automatically switches back to current lap time after crossing first sector line
- Last lap and best lap comparison
- Toast notifications for timing events
- Back button returns to track detail if session active

**Delta Display Logic:**

The info panel intelligently switches between three display modes:

1. **Distance Mode** (before lap start): Shows distance to start line in meters
    - Only start line distance is shown (not sector or finish line distances)
2. **Current Lap Mode** (during lap): Shows elapsed time since lap start
3. **Delta Mode** (after finish, until first sector): Shows time difference from comparison lap:
    - If ghost mode OFF: compares to personal best lap
    - If ghost mode ON: compares to best lap from ghost (external) participant
    - Positive delta (red) = slower than comparison
    - Negative delta (green) = faster than comparison

The delta mode is enabled when crossing the finish line and disabled when crossing the first sector line of the new lap.

### TrackDetailScreen

Track information and session management.

**Features:**

- Map view with timing lines
- Start/End Session button (changes based on session state)
- Lap trajectory selector (horizontal scroll)
- Trajectory visualization on map (polyline overlay)
- Shows user location when session active

**Lap Trajectory:**

- User can select any completed lap
- Selected lap trajectory is drawn on map
- Tap again to deselect

## Performance Considerations

### High-Frequency GPS Processing

- GPS/IMU fusion runs at 10-20Hz
- Crossing detection is optimized to run in <5ms
- Uses refs instead of state for high-frequency updates
- Throttles UI updates to 50ms intervals

### Memory Management

- Trajectories stored in efficient array format
- Old trajectories can be cleared when session ends
- AsyncStorage used for persistence (lap times only, not trajectories)

### Accuracy

- Sub-100ms timing accuracy with interpolation
- Requires GPS accuracy better than 15m
- Line width of 24m (2 × 12m) provides margin for GPS error

## Future Enhancements

Potential improvements:

1. **Trajectory Comparison**: Overlay multiple lap trajectories
2. **Speed Heatmap**: Color trajectory by speed
3. **Optimal Racing Line**: Calculate and display ideal path
4. **Sector Analysis**: Detailed sector-by-sector comparison
5. **Export Data**: Export lap data as GPX/CSV files
6. **Predictive Lap Time**: Estimate final lap time based on current sectors

## Troubleshooting

### GPS Accuracy Issues

- Ensure location permissions granted (foreground + background)
- Check GPS signal strength (open sky preferred)
- Timing lines should be perpendicular to track direction
- Avoid narrow chicanes where GPS may lose accuracy

### Double Triggering

- Increase debounce times if needed
- Ensure re-arm distance is appropriate for track
- Check that timing lines are not too close together

### Missing Crossings

- Verify GPS update rate is sufficient (10Hz minimum)
- Check line width is appropriate (24m total recommended)
- Ensure accuracy threshold is not too strict (15m default)

## License

This documentation is part of the Track Coach application.
