# Jak poznat, že používáte Mock GPS data

## Problém

GPS ikona na telefonu svítí i když používáte mock GPS data. To je normální - Expo Location API skutečně aktivuje GPS
hardware, ale mock provider pak nahrazuje skutečná data simulovanými.

## Způsoby, jak ověřit, že používáte Mock GPS

### 1. **Konzole v Metro Bundler / Expo Go**

Při používání mock GPS se zobrazují tyto zprávy:

```
🔧 🔧 🔧 MOCK GPS STARTED 🔧 🔧 🔧
Track: Autodrom Most
Points: 112
Duration: 120.0s
Playback speed: 1x
=====================================
```

Během přehrávání (každý 10. bod):

```
🔧 MOCK GPS: Point 10/112 - Lat: 50.552900, Lng: 13.638700, Speed: 50.0 m/s
🔧 MOCK GPS: Point 20/112 - Lat: 50.554200, Lng: 13.638100, Speed: 29.1 m/s
🔧 MOCK GPS: Point 30/112 - Lat: 50.555200, Lng: 13.637100, Speed: 47.2 m/s
```

Při zastavení:

```
🔧 MOCK GPS STOPPED
```

### 2. **Vizuální indikátory v aplikaci**

V LapTimerScreen se zobrazuje:

- **Oranžový badge "🔧 MOCK"** vedle názvu trati v hlavičce
- Badge je viditelný pouze když je mock GPS aktivní

### 3. **GPS pozice se nemění s pohybem telefonu**

Pokud jste fyzicky na místě jiném než simulovaná trať:

- Vaše skutečná GPS pozice by byla např. Praha
- Mock GPS data jsou např. z Autodromu Most
- Pokud se zobrazují pozice z Autodromu Most → používáte mock data

### 4. **AsyncStorage kontrola**

V kódu můžete zkontrolovat:

```typescript
const mockEnabled = await AsyncStorage.getItem('@track_coach:mock_gps_enabled');
const mockProvider = getMockLocationProvider();
const isActive = mockEnabled === 'true' && mockProvider.isActive();

console.log('Mock GPS aktivní:', isActive);
```

### 5. **Rychlost a pozice odpovídají mock track souboru**

Pokud používáte `autodrom-most.json`:

- Startovní pozice: 50.519446, 13.607735
- Maximální rychlost: ~68 km/h (18.8 m/s)
- Délka trati: 120 sekund

Pokud vidíte tyto hodnoty → používáte mock data.

## Co dělat, když mock GPS nefunguje

1. **Zkontrolujte konzoli** - měli byste vidět zprávu "MOCK GPS STARTED"
2. **Zkontrolujte nastavení** - ujistěte se, že mock GPS je zapnutý v Settings
3. **Restartujte session** - ukončete a znovu spusťte lap session
4. **Restartujte aplikaci** - reload Metro Bundler

## Technické detaily

- Mock GPS nahrazuje **pouze GPS data uvnitř aplikace**
- Systémová GPS ikona bude svítit normálně (to je správné chování)
- Jiné aplikace (Mapy, atd.) budou používat skutečnou GPS
- Mock data jsou přehrávána s časovým rozlišením cca 16ms (60 FPS)

## Příklad logů při správném fungování

```
🔧 🔧 🔧 MOCK GPS STARTED 🔧 🔧 🔧
Track: Autodrom Most
Points: 112
Duration: 120.0s
Playback speed: 1x
=====================================
🔧 MOCK GPS: Point 10/112 - Lat: 50.552900, Lng: 13.638700, Speed: 50.0 m/s
🔧 MOCK GPS: Point 20/112 - Lat: 50.554200, Lng: 13.638100, Speed: 29.1 m/s
🔧 MOCK GPS: Point 30/112 - Lat: 50.555200, Lng: 13.637100, Speed: 47.2 m/s
🔧 MOCK GPS: Point 40/112 - Lat: 50.556300, Lng: 13.636000, Speed: 58.8 m/s
...
🔧 MOCK GPS STOPPED
```

Pokud tyto zprávy vidíte v konzoli → **mock GPS funguje správně**.

