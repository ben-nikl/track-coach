# Lap Session Architecture Documentation

## Overview

The Lap Session system is the core timing engine of Track Coach. It provides real-time lap timing, sector splits, and
crossing detection using high-frequency GPS/IMU sensor fusion. The system processes location data at up to 10Hz to
achieve millisecond-accurate lap times.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Key Components](#key-components)
5. [Helper Functions](#helper-functions)
6. [State Management](#state-management)
7. [Crossing Detection Algorithm](#crossing-detection-algorithm)
8. [Performance Optimizations](#performance-optimizations)

---

## Core Concepts

### Track Geometry

Each track consists of:

- **Start Line**: Where laps begin (perpendicular to track direction)
- **Finish Line**: Where laps end (can be same as start line)
- **Sector Lines**: Intermediate timing points dividing the lap into segments

All lines are defined by:

- `center`: Geographic center point (lat/lon)
- `trackP1`, `trackP2`: Two points on the track edge defining the line orientation

The system computes perpendicular segments extending 12 meters on each side of the track centerline.

### Line Crossing Detection

The system detects when a vehicle's path crosses a timing line by:

1. Receiving consecutive GPS positions (p1 → p2)
2. Checking if the segment p1-p2 intersects with a timing line
3. Computing the interpolated crossing time using the intersection parameter `t`
4. Applying debouncing to prevent multiple triggers

### Arming/Disarming Logic

To prevent multiple crossings from a single pass:

- Lines start **armed** (ready to detect crossings)
- After crossing, a line becomes **disarmed**
- When vehicle moves >6m away, the line **rearms**
- Only armed lines can trigger timing events

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LapSessionProvider                        │
│  (React Context providing timing state & controls)          │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼────────┐          ┌──────▼──────────┐
│  GPS (1Hz)     │          │  Fused (10Hz)   │
│  Anchor Points │          │  High Precision │
└───────┬────────┘          └──────┬──────────┘
        │                           │
        └─────────────┬─────────────┘
                      │
              ┌───────▼────────┐
              │ processFusedLike│
              │  (Crossing Det.)│
              └───────┬────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼───┐   ┌────▼────┐   ┌────▼────┐
   │ Start  │   │ Sector  │   │ Finish  │
   │ Cross  │   │ Cross   │   │ Cross   │
   └────┬───┘   └────┬────┘   └────┬────┘
        │            │             │
        └────────────┼─────────────┘
                     │
              ┌──────▼──────┐
              │   Events    │
              │   & Laps    │
              └─────────────┘
```

### Dual Location System

1. **GPS Anchor (1Hz)**: Standard Expo Location API
    - Provides reliable position updates
    - Fallback when fused data unavailable
    - Used for distance calculations to lines

2. **Fused High-Frequency (10Hz)**: IMU + GPS fusion
    - Combines accelerometer, gyroscope, magnetometer with GPS
    - 10x higher frequency for precise crossing detection
    - Millisecond-accurate timing interpolation

---

## Data Flow

### Session Lifecycle

```
Start Session
    ↓
Initialize Track Geometry
    ↓
Request Location Permissions
    ↓
Start Background Location + Fused Manager
    ↓
[Location Updates Loop]
    ↓
Process Each Sample (GPS or Fused)
    ↓
Check Line Crossings
    ↓
Trigger Events (Start/Sector/Finish)
    ↓
Update State & Persist Laps
    ↓
End Session
    ↓
Stop Location Services
```

### Event Flow

```
User crosses Start Line
    ↓
checkStartLineCrossing() detects intersection
    ↓
startLap(timestamp) called
    ↓
currentLapStartMs set
    ↓
Sector timers armed
    ↓
User crosses Sector 1
    ↓
checkSectorCrossings() detects
    ↓
markSectorCrossing() records split
    ↓
Toast notification shown
    ↓
... more sectors ...
    ↓
User crosses Finish Line
    ↓
checkFinishLineCrossing() detects
    ↓
finishLap(timestamp) called
    ↓
Calculate lap time & sector splits
    ↓
Persist to AsyncStorage
    ↓
Update best/last lap times
    ↓
If same start/finish: auto-start next lap
```

---

## Key Components

### LapSessionProvider

**Purpose**: Root context provider managing all timing state and location services.

**Responsibilities**:

- Manage session lifecycle (start/stop)
- Coordinate GPS and fused location sources
- Detect line crossings
- Maintain lap/sector timing state
- Persist lap data
- Provide UI notifications (toasts)

**Key State**:

```typescript
// Session control
sessionActive: boolean
trackData: Track | null

// Timing data
currentLapStartMs: number | null
lapTimes: number[]
lastLapMs: number | null
bestLapMs: number | null
sectorsTiming: SectorTimingState[]

// Events log
events: LapEvent[]
laps: LapRecord[]

// UI state
lineDistances: DistanceResult[]
toastMessages: ToastMsg[]
```

### Location Processing

#### processLocation(loc: LocationObject)

**Purpose**: Process 1Hz GPS updates from Expo Location.

**Flow**:

1. Validate accuracy (must be <15m)
2. Update previous location reference
3. Calculate distances to all timing lines
4. If no fused data available, call `processFusedLike()` as fallback

**Usage**: Provides coarse position tracking and fallback crossing detection.

#### fusedSampleHandler(sample: FusedSample)

**Purpose**: Process 10Hz high-frequency fused sensor data.

**Flow**:

1. Validate sample source is 'fused'
2. Call `processFusedLike()` with previous and current positions
3. Update fused sample state (throttled to 50ms for UI)
4. Extract and expose speed in m/s

**Usage**: Primary source for accurate crossing detection.

#### processFusedLike(tPrev, latPrev, lonPrev, tCur, latCur, lonCur)

**Purpose**: Core crossing detection logic using two consecutive positions.

**Algorithm**:

1. **Update Arming States**: Check if vehicle is far enough from each line to rearm
2. **Calculate Distances**: Compute perpendicular distance to all lines for UI
3. **Check Session Active**: Skip crossing detection if session not running
4. **Start Line Check**: If no lap running, detect start line crossing
5. **Finish Line Check**: If lap running, detect finish crossing
6. **Sector Checks**: If no finish crossing, check all sector lines

**Performance**: Optimized to run at 10Hz without blocking UI.

---

## Helper Functions

### calculateCrossingTime()

```typescript
function calculateCrossingTime(
    tPrev: number,      // Previous sample timestamp (ms)
    tCur: number,       // Current sample timestamp (ms)
    p1: Point,          // Previous position
    p2: Point,          // Current position
    lineStart: Point,   // Line segment start
    lineEnd: Point      // Line segment end
): number | null
```

**Purpose**: Calculate exact crossing time using linear interpolation.

**Algorithm**:

1. Check if segments p1-p2 and line intersect
2. If no intersection, return null
3. Calculate intersection parameter `t ∈ [0,1]` along p1-p2
4. Interpolate timestamp: `tCross = tPrev + t × (tCur - tPrev)`
5. Round to nearest millisecond

**Example**: If intersection is 30% along the movement path, and movement took 100ms, crossing time is tPrev + 30ms.

### computeLineDistances()

```typescript
function computeLineDistances(
    currentPoint: Point,
    trackData: Track,
    startSegment: LineSegment,
    finishSegment: LineSegment,
    sectorSegments: { id: string; seg: LineSegment }[],
    isSameStartFinish: boolean
): DistanceResult[]
```

**Purpose**: Calculate perpendicular distances from current position to all timing lines.

**Returns**: Array of objects with:

- `id`: Line identifier
- `label`: Display name ("START", "FINISH", "SECTOR 1", etc.)
- `distance`: Perpendicular distance in meters

**Usage**: Powers UI proximity indicators showing how close vehicle is to each line.

### updateLineArmingStates()

```typescript
function updateLineArmingStates(
    currentPoint: Point,
    startSegment: LineSegment,
    finishSegment: LineSegment,
    sectorSegments: { id: string; seg: LineSegment }[],
    isSameStartFinish: boolean,
    startArmedRef: { current: boolean },
    finishArmedRef: { current: boolean },
    segmentArmedRef: { current: Record<string, boolean> },
    rearmDistance: number  // = 6 meters
)
```

**Purpose**: Update armed/disarmed state of all timing lines based on distance.

**Logic**:

- If line is currently **disarmed** AND distance ≥ 6m → **rearm**
- Prevents immediate re-triggering after crossing
- Handles special case of same start/finish line

**Mutation**: Updates refs in-place (no return value).

### checkStartLineCrossing()

```typescript
function checkStartLineCrossing(
    p1: Point, p2: Point,
    tPrev: number, tCur: number,
    startSegment: LineSegment,
    isSameStartFinish: boolean,
    startArmedRef: { current: boolean },
    finishArmedRef: { current: boolean },
    lastStartCrossRef: { current: number },
    startLapCallback: ((t: number) => void) | null,
    debounceMs: number  // = 1200ms
): boolean
```

**Purpose**: Detect and handle start line crossings.

**Algorithm**:

1. Check if start line is armed
2. Calculate crossing time
3. Apply debouncing (prevent triggers within 1200ms)
4. Disarm start line
5. Call `startLapCallback(crossingTime)`
6. If same start/finish, also disarm finish line

**Returns**: `true` if crossing detected and processed.

**Debouncing**: Prevents double-triggers from GPS jitter or slow crossings.

### checkFinishLineCrossing()

```typescript
function checkFinishLineCrossing(
    p1: Point, p2: Point,
    tPrev: number, tCur: number,
    finishSegment: LineSegment,
    finishArmedRef: { current: boolean },
    lastFinishCrossRef: { current: number },
    finishLapCallback: ((t: number) => void) | null,
    debounceMs: number  // = 800ms
): boolean
```

**Purpose**: Detect and handle finish line crossings.

**Similar to start line check**, but:

- Uses finish line geometry
- Shorter debounce (800ms)
- Calls `finishLapCallback(crossingTime)`

**Returns**: `true` if crossing detected (used to skip sector checks).

### checkSectorCrossings()

```typescript
function checkSectorCrossings(
    p1: Point, p2: Point,
    tPrev: number, tCur: number,
    sectorSegments: { id: string; seg: LineSegment }[],
    segmentArmedRef: { current: Record<string, boolean> },
    lastSectorCrossTimesRef: { current: Record<string, number> },
    markSectorCallback: ((id: string, t: number) => void) | null,
    debounceMs: number  // = 800ms
)
```

**Purpose**: Check all sector lines for crossings.

**Algorithm**:

1. Iterate through all sector segments
2. Skip if sector line is disarmed
3. Calculate crossing time for each armed sector
4. Apply per-sector debouncing
5. Disarm the crossed sector
6. Call `markSectorCallback(sectorId, crossingTime)`

**Optimization**: Early exits for disarmed sectors avoid unnecessary calculations.

---

## State Management

### Event Logging

Events provide an immutable audit trail of all timing events.

```typescript
interface LapEvent {
    id: string;              // Unique identifier
    type: 'start' | 'sector' | 'finish';
    lapIndex: number;        // Which lap number
    sectorIndex?: number;    // Which sector (if type='sector')
    timestampMs: number;     // Event time (milliseconds since epoch)
    wallClockISO: string;    // Human-readable timestamp
    lapElapsedMs?: number;   // Time since lap start
    splitMs?: number;        // Split time for this segment
}
```

**Usage**: Exported for analysis, replay, or debugging.

### Lap Records

Persistent lap data for historical tracking.

```typescript
interface LapRecord {
    lapIndex: number;       // Sequential lap number
    lapTimeMs: number;      // Total lap time
    sectorSplitsMs: number[]; // Array of sector split times
}
```

**Persistence**: Stored in AsyncStorage keyed by track ID.

### Sector Timing

Active tracking of current lap's sector splits.

```typescript
interface SectorTimingState {
    id: string;      // Sector identifier
    timeMs?: number; // Split time (undefined until crossed)
}
```

**Updates**: New sector added to array as each line is crossed.

### Refs for Stable References

**Why refs instead of state?**

- Avoid re-render cycles in high-frequency loops
- Maintain stable references across callback updates
- Enable synchronous reads in location handlers

**Key refs**:

```typescript
trackDataRef          // Current track geometry
sessionActiveRef      // Is session running?
currentLapStartMsRef  // When did current lap start?
startArmedRef         // Is start line armed?
finishArmedRef        // Is finish line armed?
segmentArmedRef       // Arming state of each sector
lastSectorCrossTimesRef // Last crossing time per sector
```

---

## Crossing Detection Algorithm

### Segment Intersection Math

Given two line segments:

- **Movement path**: p1 → p2 (vehicle trajectory)
- **Timing line**: lineStart → lineEnd

**Intersection test**:

```
Does the line p1-p2 intersect lineStart-lineEnd?
```

**Parametric form**:

```
Point on path: P(t) = p1 + t(p2 - p1), t ∈ [0,1]
Point on line: L(s) = lineStart + s(lineEnd - lineStart), s ∈ [0,1]
```

**Solution**: Solve for `t` and `s` where P(t) = L(s).

**Crossing time**: `tCross = tPrev + t × (tCur - tPrev)`

### Debouncing Strategy

Each line type has different debounce periods:

| Line Type | Debounce | Reason                                                   |
|-----------|----------|----------------------------------------------------------|
| Start     | 1200ms   | Prevent false triggers before vehicle fully enters track |
| Sector    | 800ms    | Balance between responsiveness and stability             |
| Finish    | 800ms    | Quick detection while preventing double-crossing         |

**Mechanism**: Store last crossing timestamp per line; ignore new crossings within debounce window.

### Arming Distance

**Why 6 meters?**

- Far enough to ensure vehicle has passed the line
- Close enough to rearm before returning from short track sections
- Tested balance for typical track widths (8-15m)

**Edge case**: Very tight hairpins might need smaller threshold.

---

## Performance Optimizations

### 1. Throttled State Updates

**Problem**: 10Hz updates would cause 10 re-renders/second.

**Solution**: Throttle fused sample state updates to max 20Hz (50ms):

```typescript
if (now - fusedThrottleRef.current > 50) {
    setLastFusedSample(sample);
    setFusedSpeedMps(sample.speedMps);
}
```

### 2. Ref-Based Processing

**Problem**: State changes in callbacks cause dependency chains and re-renders.

**Solution**: Use refs for data that doesn't need to trigger renders:

- `fusedSampleHandlerRef`: Stable reference, no deps
- `trackDataRef`, `sessionActiveRef`: Synchronous access without closure stale values

### 3. Early Exits

**Crossing detection** short-circuits:

1. If crossing lock active → return (prevents recursion)
2. If accuracy too poor → return
3. If session not active → return after distance calculation
4. If no lap started → only check start line
5. If finish line crossed → skip sector checks

### 4. Try-Catch Isolation

Distance calculations wrapped in try-catch:

```typescript
try {
    const distances = computeLineDistances(...);
    setLineDistances(distances);
} catch {
    // Silently fail distance calculations
    // (they're for UI only, don't break timing)
}
```

**Rationale**: UI features (distance display) shouldn't crash core timing logic.

### 5. Deferred Event Logging

Event creation deferred to next tick:

```typescript
defer(() => logSector(crossingTimeMs, lapElapsed, split, sectorIndex));
```

**Benefits**:

- Keeps crossing detection fast
- Prevents state update conflicts
- Smooths out UI updates

### 6. Crossing Lock

Prevents recursive crossing handling during finish:

```typescript
if (crossingLockRef.current) return;
crossingLockRef.current = true;
// ... finish lap logic ...
crossingLockRef.current = false;
```

**Scenario**: Same start/finish auto-starts next lap; lock prevents start detection from re-entering.

---

## Advanced Features

### Same Start/Finish Auto-Lap

When start and finish lines are identical:

1. Crossing finish line completes current lap
2. **Immediately** starts next lap with same timestamp
3. Both start and finish lines disarmed briefly
4. Prevents double-triggering on same crossing

**Code**:

```typescript
if (isSameStartFinishRef.current) {
    setTimeout(() => {
        startLap(finishTimeMs);  // Reuse finish time as start time
        startArmedRef.current = false;
        finishArmedRef.current = false;
        crossingLockRef.current = false;
    }, 30);
}
```

### Ghost Lap / Best Lap

**Ghost lap**: Best lap time shown as reference during current lap.

**Calculation**: Minimum of all recorded lap times.

**UI**: Shows delta (ahead/behind) at each sector.

### Sector Boxes

Dynamic UI elements showing sector progress:

```typescript
{
    index: 1,           // Sector number
        time
:
    24530,        // Split time in ms (or undefined)
        active
:
    true        // Currently in this sector?
}
```

**Calculation**:

- Total sectors = track.sectors.length + 1 (final sector to finish)
- Active index = number of completed sectors + 1
- Time filled in as sectors are crossed

---

## Error Handling

### Permission Errors

```typescript
permissionError: string | null
```

Tracks:

- Foreground location denied
- Background location denied (iOS requires "Always" permission)

**User action**: Show alert, link to settings.

### GPS Accuracy

Minimum required accuracy: **15 meters**

Samples with worse accuracy are discarded:

```typescript
if (loc.coords.accuracy != null && loc.coords.accuracy > REQUIRED_ACCURACY_M) return;
```

**Typical accuracy**:

- Good conditions: 3-8m
- Degraded: 10-15m
- Poor (tunnels, buildings): 20-100m

### Geometry Computation Errors

Track geometry calculations wrapped in try-catch during initialization.

**Failure mode**:

- Lines not created → no crossing detection
- Session can still run, but won't detect crossings

**User feedback**: Should validate track data before session start.

---

## Configuration Constants

| Constant                | Value  | Purpose                                        |
|-------------------------|--------|------------------------------------------------|
| `LINE_HALF_WIDTH_M`     | 12m    | Timing line extends this far from track center |
| `REQUIRED_ACCURACY_M`   | 15m    | Minimum GPS accuracy to use sample             |
| `START_DEBOUNCE_MS`     | 1200ms | Prevent repeated start triggers                |
| `SEGMENT_DEBOUNCE_MS`   | 800ms  | Prevent repeated sector triggers               |
| `FINISH_DEBOUNCE_MS`    | 800ms  | Prevent repeated finish triggers               |
| `LINE_REARM_DISTANCE_M` | 6m     | Distance needed to rearm a line                |

**Tuning**: These values balance accuracy, responsiveness, and false-positive prevention.

---

## Future Enhancements

### Potential Improvements

1. **Kalman Filtering**: Smooth GPS jitter for even better accuracy
2. **Predictive Crossing**: Use velocity vector to predict crossing slightly in advance
3. **Multi-Lap Statistics**: Rolling averages, consistency metrics
4. **Weather/Condition Tracking**: Correlate lap times with conditions
5. **Replay Mode**: Visualize recorded laps on map
6. **Export Formats**: GPX, TCX, CSV for external analysis

### Known Limitations

1. **Tunnel/Bridge Loss**: GPS loss causes missed crossings
2. **Very Slow Speeds**: <5 km/h may have poor crossing accuracy
3. **Parallel Lines**: Lines very close together (<10m) may confuse detection
4. **Device Variation**: Different phones have different sensor quality

---

## Testing Recommendations

### Unit Tests

- `calculateCrossingTime()`: Test intersection calculation with known geometries
- `computeLineDistances()`: Verify distance calculations
- Arming logic: Test state transitions

### Integration Tests

- Full lap sequence: start → sectors → finish
- Same start/finish auto-lap behavior
- Permission handling flows

### Field Tests

- **Slow lap**: Walk/drive slowly, verify all crossings detected
- **Fast lap**: High speed, verify interpolation accuracy
- **Repeated laps**: Check consistency over 10+ laps
- **Edge crossings**: Cross at extreme angles (45°, 90°)
- **Poor GPS**: Test in degraded conditions

### Performance Tests

- **Battery drain**: Monitor over 1-hour session
- **Memory**: Check for leaks in long sessions
- **UI responsiveness**: Verify 60fps during active timing

---

## Conclusion

The Lap Session system provides a robust, high-accuracy timing solution by combining:

- Dual location sources (1Hz GPS + 10Hz fused)
- Precise mathematical intersection detection
- Smart arming/debouncing logic
- Optimized React rendering patterns
- Comprehensive state management

This architecture achieves **millisecond-accurate** lap timing suitable for amateur and semi-professional motorsport
applications.

For questions or contributions, refer to the inline code documentation in `LapSessionContext.tsx`.

