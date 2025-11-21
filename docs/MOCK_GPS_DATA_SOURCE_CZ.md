roc# Mock GPS - Trasování Zdroje Dat

## Přehled

Systém mock GPS nyní jasně zobrazuje, odkud se berou data pro simulaci GPS pozic. Každé načtení tracku obsahuje
informaci o zdroji dat.

## Zdroje Dat

### 1. Built-in Tracky (Vestavěné)

- **Umístění**: `assets/mock-tracks/*.json`
- **Příklad**: `assets/mock-tracks/autodrom-most.json`
- **Identifikace**: Track ID neobsahuje prefix `custom-`
- **Zobrazení**: `Zdroj: assets/mock-tracks/[trackId].json`

### 2. Custom Tracky (Exportované ze Session)

- **Umístění**: AsyncStorage pod klíčem `@track_coach:mock_tracks`
- **Vytvoření**: Export z reálné nahrané session
- **Identifikace**: Track ID začíná prefixem `custom-`
- **Zobrazení**: `Zdroj: Custom Session Export`

## Implementace Trasování

### MockLocationProvider

Provider nyní obsahuje:

- **trackSource**: String identifikující zdroj dat
- **getDebugInfo()**: Metoda vracející kompletní debug informace včetně:
    - `trackName`: Název tratě
    - `trackId`: Jedinečné ID
    - `source`: Zdroj dat (soubor nebo "Custom Session Export")
    - `isActive`: Stav přehrávání
    - `currentPoint`: Aktuální bod v tracku
    - `totalPoints`: Celkový počet bodů
    - `progress`: Progres přehrávání (0.0 - 1.0)

### Volání loadTrack

Všechna místa, kde se volá `loadTrack()`, nyní předávají source parametr:

```typescript
const source = mockTrackId.startsWith('custom-')
    ? 'Custom Session Export'
    : `assets/mock-tracks/${mockTrackId}.json`;

mockProvider.loadTrack({
    track: mockTrack,
    playbackSpeed: mockSpeed ? parseFloat(mockSpeed) : 1.0,
    loop: true,
    autoStart: false,
}, source);
```

## Zobrazení v UI

### StatsScreen

StatsScreen nyní zobrazuje debug panel s informacemi:

```
🔧 MOCK GPS AKTIVNÍ / NAČTENO (náhled)
Track: Autodrom Most
Zdroj: assets/mock-tracks/autodrom-most.json
ID: autodrom-most
Progres: 45.2% (234/520 bodů)  // pouze když je aktivní
```

Panel se zobrazuje pouze když:

1. Mock GPS je povoleno v nastavení
2. Je načten nějaký track

### Barevné Rozlišení

- **Náhled (neaktivní)**: Panel zobrazuje "NAČTENO (náhled)"
- **Aktivní přehrávání**: Panel zobrazuje "AKTIVNÍ" + progres

## Console Logging

### Při načtení tracku

```typescript
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
```

### Během přehrávání

Každý 10. bod:

```
🔧 MOCK GPS: Point 230/520 - Lat: 50.519624, Lng: 13.606202, Speed: 22.2 m/s
```

### V LapSessionContext

```
🔧 Mock GPS initialized: Autodrom Most at 1x speed from assets/mock-tracks/autodrom-most.json
```

## Testování

### Ověření Zdroje Dat

1. **Built-in track**:
    - Jdi do Nastavení → Mock GPS
    - Vyber "Autodrom Most"
    - Jdi na Stats obrazovku
    - Ověř: `Zdroj: assets/mock-tracks/autodrom-most.json`

2. **Custom track**:
    - Nahraj session s reálnými GPS daty
    - Exportuj lap jako mock track
    - Vyber exportovaný track v nastavení
    - Ověř: `Zdroj: Custom Session Export`
    - ID začíná `custom-session_...`

### Debug Informace

V konzoli sleduj:

- Načtení tracku s detaily
- Body během přehrávání
- Inicializaci v session contextu

## Benefit

✅ **Jasná identifikace zdroje dat** - víš přesně, odkud se berou mock GPS data  
✅ **Snadné debugování** - když něco nefunguje, vidíš zdroj dat  
✅ **Rozlišení built-in vs custom** - rychle poznáš typ tracku  
✅ **Progres tracking** - vidíš, kde v tracku se nacházíš  
✅ **Console logging** - kompletní historie v konzoli

## Struktura Dat

### Built-in Track (JSON soubor)

```json
{
  "trackName": "Autodrom Most",
  "trackId": "autodrom-most",
  "description": "Simulované kolo na Autodromu Most",
  "duration": 120000,
  "points": [
    {
      "latitude": 50.519446,
      "longitude": 13.607735,
      "timestamp": 0,
      "speed": 0,
      "accuracy": 5
    },
    ...
  ]
}
```

### Custom Track (z AsyncStorage)

```json
{
  "trackName": "Autodrom Most - Session 1234567890",
  "trackId": "custom-session_1234567890-lap0",
  "description": "Exported from real session on 11/20/2025",
  "duration": 125340,
  "points": [
    ...
  ]
}
```

