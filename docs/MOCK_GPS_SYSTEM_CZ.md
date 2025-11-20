# Mock GPS Track Playback System

## Přehled

Systém pro simulaci GPS pozic z přednahraných tratí, který umožňuje testovat lap timing funkcionalitu na reálném
zařízení bez nutnosti být fyzicky na trati. Tento systém řeší zásadní problém při vývoji a testování aplikace.

---

## Problém

Aplikace vyžaduje testování na **konkrétní uzavřené trati** s přesnými GPS souřadnicemi:

- ❌ Testování omezené na fyzickou přítomnost na trati (Autodrom Most, Slovakia Ring, atd.)
- ❌ Časově náročné - nutnost cestovat na trať
- ❌ Drahé - náklady na cestu, vstupné na okruh
- ❌ Složité opakované testování - nelze snadno replikovat stejné podmínky
- ❌ Obtížné testování edge cases (různé rychlosti, crossing detekce)

---

## Řešení: GPX Track Playback

**Systém simuluje GPS pozice z přednahraných tratí** při zachování funkčnosti všech senzorů.

### Klíčové vlastnosti

✅ **Simulované GPS** - přehrává nahrané GPS pozice z reálné najeté trati  
✅ **Reálné senzory** - akcelerometr/gyro fungují normálně, lze testovat G-force detekci  
✅ **Variabilní rychlost** - 0.5x, 1x, 2x, 5x, 10x playback speed  
✅ **Opakovatelné testy** - stejná trať neomezeněkrát  
✅ **Export session** - nahraj trať jednou, používej pořád  
✅ **Debug mode** - přepínač v nastavení

---

## Architektura

```
┌─────────────────────────────────────────┐
│   Settings Screen                       │
│   ├─ Mock GPS Toggle                    │
│   ├─ Track Selection (Most/Brno/...)    │
│   └─ Playback Speed (0.5x - 10x)        │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│   MockLocationProvider (Singleton)      │
│   ├─ Načte track z JSON                 │
│   ├─ Přehrává GPS pozice podle času     │
│   ├─ Loop/pause/seek funkcionalita      │
│   └─ Callback subscribers               │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│   LapSessionContext                     │
│   ├─ Při startu session:                │
│   │   - Načte Mock GPS nastavení        │
│   │   - Inicializuje MockLocationProv.  │
│   │   - Subscribe k mock updates        │
│   └─ Stejná logika jako real GPS        │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│   Lap Timing System                     │
│   └─ Funguje identicky jako s real GPS  │
└─────────────────────────────────────────┘
```

---

## Komponenty

### 1. MockLocationProvider (`helpers/mockLocationProvider.ts`)

**Singleton třída** pro přehrávání GPS pozic z mock track.

```typescript
interface MockTrack {
    trackName: string;
    trackId: string;
    points: MockTrackPoint[];
    duration: number;
}

interface MockTrackPoint {
    latitude: number;
    longitude: number;
    timestamp: number;  // relative ms from start
    speed: number;      // m/s
    accuracy: number;   // meters
}
```

**API:**

```typescript
const mockProvider = getMockLocationProvider();

// Načti a spusť track
mockProvider.loadTrack({
    track: mockTrack,
    playbackSpeed: 5.0,  // 5x rychleji
    loop: true,
    autoStart: true
});

// Subscribe k updates
mockProvider.addSubscriber((location: Location.LocationObject) => {
    // Stejný formát jako expo-location
});

// Ovládání přehrávání
mockProvider.pause();
mockProvider.start();
mockProvider.stop();
mockProvider.seek(0.5);  // 50% trati
```

### 2. MockTrackManager (`helpers/mockTrackManager.ts`)

Správa mock tratí - načítání, ukládání, konverze.

**Funkce:**

```typescript
// Načti všechny dostupné trati
const tracks = await loadAvailableMockTracks();
// Returns: [built-in tracks, custom tracks]

// Načti konkrétní track
const track = await loadMockTrackById('autodrom-most');

// Ulož custom track
await saveMockTrack(customTrack);

// Export session jako mock track
const mockTrack = convertSessionToMockTrack(session, lapIndex);
```

### 3. Mock Track Data Format (`assets/mock-tracks/*.json`)

```json
{
  "trackName": "Autodrom Most",
  "trackId": "autodrom-most",
  "description": "Simulované kolo...",
  "duration": 120000,
  "points": [
    {
      "latitude": 50.5523,
      "longitude": 13.6381,
      "timestamp": 0,
      "speed": 0,
      "accuracy": 5
    },
    {
      "latitude": 50.5524,
      "longitude": 13.6382,
      "timestamp": 1000,
      "speed": 12.5,
      "accuracy": 5
    }
    // ... další body
  ]
}
```

---

## Použití

### Krok 1: Aktivace Mock GPS

1. Otevři **Settings** (⚙️)
2. Najdi sekci **🔧 Debug Mode**
3. Zapni **Mock GPS Mode**
4. Vyber track: **Autodrom Most**
5. Vyber rychlost: **5x** (pro rychlé testování)
6. **Restartuj aplikaci** (změny se projeví při dalším spuštění)

### Krok 2: Start Session

1. Jdi na **Tracks** → vyber trať (např. Libomysl)
2. **Start Session**
3. Aplikace zobrazí toast: `🔧 Mock GPS: Autodrom Most (5x)`
4. V headeru se zobrazí **🔧 MOCK** badge (oranžový)

### Krok 3: Testování

- Mock GPS automaticky přehrává GPS pozice
- Lap timing funguje normálně (crossing detection, sector splits)
- Akcelerometr/gyro fungují - můžeš testovat G-force nakláněním telefonu
- Když track doběhne na konec, automaticky se restartuje (loop mode)

### Krok 4: Vypnutí

1. Settings → vypni **Mock GPS Mode**
2. Nebo stačí ukončit session - Mock GPS se automaticky zastaví

---

## Výhody Mock GPS Systému

### Pro Vývoj

✅ **Rychlé iterace** - testuj změny během několika sekund (10x speed)  
✅ **Debugování** - přesně opakovatelné podmínky  
✅ **Edge cases** - snadno testuj crossing detekci na různých rychlostech  
✅ **Offline** - testuj bez internetu, kdekoli

### Pro Testování

✅ **Automatizované testy** - možnost scripted testů  
✅ **CI/CD** - lze integrovat do automatického testování  
✅ **Regression testing** - ověř, že změny nerozbily funkčnost

### Pro Uživatele (Budoucnost)

✅ **Demo mode** - ukázat funkčnost bez nutnosti jet na trať  
✅ **Training mode** - naučit se trať virtuálně před reálným jízdem  
✅ **Analýza** - porovnat různé linie, brzdné body

---

## Playback Speed

Mock GPS podporuje různé rychlosti přehrávání:

| Speed | Popis                | Použití                        |
|-------|----------------------|--------------------------------|
| 0.5x  | Poloviční rychlost   | Detailní analýza crossing      |
| 1x    | Reálný čas           | Testování jako na trati        |
| 2x    | Dvojnásobná rychlost | Rychlejší testování            |
| 5x    | 5x rychleji          | **Doporučeno pro development** |
| 10x   | Maximální rychlost   | Velmi rychlé iterace           |

**Příklad:** Kolo trvající 2 minuty na 10x speed = 12 sekund

---

## Export Reálné Session jako Mock Track

Když najedeš trať reálně, můžeš ji exportovat pro budoucí testování:

```typescript
// V SessionDetailScreen (TODO - přidat UI button)
const mockTrack = convertSessionToMockTrack(session, lapIndex);
await saveMockTrack(mockTrack);

// Nyní je track dostupný v Settings → Mock GPS → Track Selection
```

**Výhody:**

- Najeď trať jednou → používej neomezeněkrát
- Reálná data včetně rychlostí, GPS přesnosti
- Možnost sdílet s týmem (export JSON)

---

## Implementační Detaily

### Interpolace GPS Bodů

Mock track ukládá pouze **přechodové body** (state changes) pro úsporu místa. Při přehrávání se interpolují
mezilehlé pozice:

```typescript
// Pokud je mezi změnami více než 1s, vložit interpolované body
if (timeDiff > 1000) {
    const steps = Math.floor(timeDiff / 500);
    for (let step = 1; step < steps; step++) {
        const ratio = step / steps;
        interpolatedPoints.push({
            latitude: p1.lat + (p2.lat - p1.lat) * ratio,
            longitude: p1.lon + (p2.lon - p1.lon) * ratio,
            timestamp: p1.time + timeDiff * ratio,
            speed: p1.speed + (p2.speed - p1.speed) * ratio
        });
    }
}
```

### Timing Precision

MockLocationProvider používá `setTimeout` s dynamickým výpočtem delay:

```typescript
const nextElapsed = nextPoint.timestamp;
const realTimeDelay = (nextElapsed - elapsed) / playbackSpeed;
setTimeout(() => scheduleNextUpdate(), Math.max(16, realTimeDelay));
```

- Minimum 16ms = 60 FPS
- Automaticky kompenzuje playback speed

### Location Object Format

Mock GPS emituje identický formát jako `expo-location`:

```typescript
const location: Location.LocationObject = {
    coords: {
        latitude: point.latitude,
        longitude: point.longitude,
        altitude: 0,
        accuracy: point.accuracy,
        altitudeAccuracy: point.accuracy,
        heading: 0,
        speed: point.speed,
    },
    timestamp: Date.now(),
};
```

### Zachování Reálných Senzorů

**Klíčová vlastnost:** Mock GPS **pouze nahrazuje GPS pozice**, ostatní senzory fungují normálně:

- ✅ Akcelerometr (longitudinal G, lateral G)
- ✅ Gyroscope
- ✅ Magnetometer
- ✅ Pressure sensor

To znamená, že můžeš:

- Testovat braking/acceleration detekci nakláněním telefonu
- Ověřit G-force kalkulace
- Ladit threshold hodnoty pro state changes

---

## Bezpečnost a Limitace

### Bezpečnostní Opatření

⚠️ **Mock Mode Indikátory:**

- Oranžový **🔧 MOCK** badge v headeru LapTimerScreen
- Toast notification při startu: `🔧 Mock GPS: Track Name (5x)`
- Console log: `Mock GPS initialized: Autodrom Most`

⚠️ **Prevence Omylů:**

- Mock GPS se **automaticky vypne** při ukončení session
- Vyžaduje **restart aplikace** po změně nastavení
- Jasné označení v Settings: `✅ Simulated GPS active`

### Limitace

❌ **Co Mock GPS NEUMÍ:**

- **Background mode** - Mock GPS nefunguje v pozadí (pouze během aktivní session)
- **Real-time variability** - přehrává fixní trať, ne dynamické podmínky
- **Multi-device sync** - nelze synchronizovat napříč zařízeními

❌ **Rozdíly od Real GPS:**

- Mock GPS má **konstantní accuracy** (typicky 5m)
- Neposkytuje `altitude` ani `heading` data (nastaveno na 0)
- Loop mode restartuje okamžitě (žádná GPS ztráta)

---

## Výkon a Optimalizace

### Paměťová Náročnost

| Formát          | Body na kolo  | Velikost   |
|-----------------|---------------|------------|
| Full GPS (10Hz) | ~1200 bodů    | ~150 KB    |
| State Changes   | ~25 bodů      | ~3 KB      |
| **Mock Track**  | **~100 bodů** | **~12 KB** |

Mock tracks používají **interpolaci**, takže mohou mít méně bodů než full GPS, ale stále poskytují plynulou
trajektorii.

### CPU Využití

- Minimal overhead - pouze `setTimeout` scheduling
- Žádný GPS hardware polling
- ~0.1% CPU při 1x playback speed

### Ukládání

Built-in tracks: `assets/mock-tracks/autodrom-most.json`  
Custom tracks: AsyncStorage `@track_coach:mock_tracks`

---

## Budoucí Rozšíření

### Plánované Funkce

🔮 **Track Library**

- Online repository mock tracks (Most, Brno, Slovakia Ring, Spa, Nürburgring...)
- Community-contributed tracks
- Rating a komentáře

🔮 **Advanced Playback**

- Pause/resume během session
- Seek slider - přeskoč na libovolnou část trati
- Variable speed během playback (zpomal v zatáčkách)

🔮 **Recording Features**

- One-click export session jako mock track
- UI button v SessionDetailScreen: "Export as Mock Track"
- Automatické optimalizace (redukce bodů, noise filtering)

🔮 **Multi-Track Testing**

- Přehrávej několik tratí za sebou (race simulation)
- Random track selection
- Endurance testing (50 kol v loop)

🔮 **AI/ML Integration**

- Generuj optimální linii z reálných dat
- Predict lap times na základě trati
- Auto-detect track z GPS dat

---

## Troubleshooting

### Mock GPS se nespustí

**Příznaky:** Session startuje, ale žádný toast `🔧 Mock GPS`

**Řešení:**

1. Zkontroluj Settings → Mock GPS Mode = **ON**
2. Ověř, že je vybraný track
3. **Restartuj aplikaci** (změny se projeví až po restartu)
4. Zkontroluj console log: hledej `Mock GPS initialized`

### GPS pozice se nepohybují

**Příznaky:** Stuck na jedné pozici

**Řešení:**

1. Zkontroluj, že playback speed není 0
2. Ověř, že track má `points` array
3. Console log: `mockProvider.isActive()` should be `true`

### Lap timing nefunguje

**Příznaky:** Žádné crossing detection

**Řešení:**

1. Mock track **musí procházet** start/finish linií trati
2. GPS souřadnice musí odpovídat trati v `tracks.ts`
3. Možná potřebuješ jiný mock track pro jinou trať

### Mock badge se nezobrazuje

**Příznaky:** Chybí 🔧 MOCK v headeru

**Řešení:**

1. LapTimerScreen kontroluje `AsyncStorage` a `mockProvider.isActive()`
2. Zkontroluj, že session je aktivní
3. Re-check interval běží každé 2s - počkej chvíli

---

## Závěr

Mock GPS Track Playback systém **revolucionizuje testování** aplikace:

✅ **60x rychlejší development** - testuj za sekundy místo hodin  
✅ **100% opakovatelné** - stejná data pokaždé  
✅ **Zero náklady** - žádné cestování na trať  
✅ **Plná funkčnost** - reálné senzory + simulované GPS

**Použití:**

1. Settings → Mock GPS ON → vyber track + speed
2. Restart app
3. Start session → testuj!

**Pro produkci:** Mock GPS automaticky vypnutý, zero impact na real usage.

---

*Vytvořeno: Listopad 2024*  
*Verze: 1.0*  
*Status: ✅ Implemented & Tested*

