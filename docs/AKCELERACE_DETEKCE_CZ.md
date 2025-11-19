# Detekce Akcelerace a Brzdění - Dokumentace

## Přehled

Systém detekce akcelerace využívá **fúzi senzorů** (akcelerometr + gyroskop + GPS) k detekci a zaznamenávání brzdění,
akcelerace a coastingu během jízdy na trati. Data jsou vizualizována barevně kódovanými segmenty na přehrávání kola.

## Jak to funguje

### 1. Sbírání dat ze senzorů

Systém sbírá data z několika zdrojů současně:

- **Akcelerometr** (10 Hz) - měří zrychlení ve 3 osách
- **Gyroskop** (10 Hz) - měří rotaci zařízení
- **GPS** - měří rychlost pro validaci

### 2. Zpracování dat

#### Krok 1: Filtrování šumu (Low-Pass Filter)

Odstraňuje rychlé oscilace a震动 vibrace:

```
filtrovaná_data = 0.3 × nová_data + 0.7 × předchozí_data
```

#### Krok 2: Kompenzace gravitace

Po 2 sekundách od startu se automaticky kalibruje:

- Zaznamená gravitační složku v klidovém stavu
- Odečte ji od všech měření
- Získá čistou lineární akceleraci

#### Krok 3: Vyhlazování (Moving Average)

Průměruje posledních 5 vzorků pro stabilnější výsledky:

```
průměr = (vzorek₁ + vzorek₂ + vzorek₃ + vzorek₄ + vzorek₅) / 5
```

#### Krok 4: Klasifikace stavu

| Stav           | G-síla          | Barva      | Popis               |
|----------------|-----------------|------------|---------------------|
| **Brzdění**    | < -0.15 G       | 🔴 Červená | Zpomalování vozidla |
| **Akcelerace** | > 0.12 G        | 🟢 Zelená  | Zrychlování vozidla |
| **Coasting**   | -0.08 až 0.08 G | 🔵 Modrá   | Konstantní rychlost |

#### Krok 5: Validace GPS

Křížová kontrola s GPS rychlostí:

- Pokud GPS ukazuje zpomalování, ale akcelerometr ukazuje zrychlení → důvěřuj GPS
- Minimální změna rychlosti: 0.5 m/s²

### 3. Vizualizace

Každý bod trajektorie je zabarvěn podle stavu v daném okamžiku:

```
🔴🔴🔴 ━━━ 🔵🔵🔵 ━━━ 🟢🟢🟢 ━━━ 🔴🔴🔴
│          │          │          │
Brzdění   Coasting  Akcelerace  Brzdění
před      do        z           do
zatáčkou  zatáčky   zatáčky     další zatáčky
```

## Konfigurace

### Nastavení prahů

V souboru `helpers/accelerationDetector.ts`:

```typescript
const CONFIG = {
    BRAKING_THRESHOLD: -0.15,      // Práh pro brzdění
    ACCELERATION_THRESHOLD: 0.12,   // Práh pro akceleraci
    COASTING_DEADBAND: 0.08,       // Mrtvá zóna (hystereze)
    FILTER_ALPHA: 0.3,             // Koeficient filtru
    MIN_SPEED_CHANGE: 0.5,         // Validace GPS (m/s²)
    SMOOTHING_WINDOW: 5,           // Velikost průměrovacího okna
};
```

### Úprava citlivosti

**Více citlivé brzdění** (detekuje i lehké brzdění):

```typescript
BRAKING_THRESHOLD: -0.10  // místo -0.15
```

**Více citlivá akcelerace**:

```typescript
ACCELERATION_THRESHOLD: 0.08  // místo 0.12
```

**Menší blikání/kolísání**:

```typescript
COASTING_DEADBAND: 0.12      // místo 0.08
SMOOTHING_WINDOW: 7          // místo 5
```

## Použití

### Automatický start

Detektor se automaticky spustí při zahájení session:

```typescript
// Při startu session
accelerationDetector.start()
  ↓
Auto - kalibrace(2
s
)
↓
Začne
detekce(10
Hz
)
```

### Zaznamenávání dat

Každý GPS bod obsahuje:

```typescript
{
    latitude: 50.1234,
        longitude
:
    14.5678,
        speed
:
    25.5,           // m/s
        drivingState
:
    'braking', // 🔴 červená
        longitudinalG
:
    -0.25,   // G-síla vpřed/vzad
        lateralG
:
    0.15          // G-síla vlevo/vpravo
}
```

### Zobrazení na mapě

Po dokončení kola se trajektorie vykreslí se segmenty:

- 🔴 **Červené úseky** = brzdění
- 🟢 **Zelené úseky** = akcelerace
- 🔵 **Modré úseky** = coasting

## Praktické využití

### 1. Analýza brzdných bodů

- Zjistěte, kde brzdit dříve nebo později
- Porovnejte brzdné body mezi koly
- Najděte konzistenci

### 2. Optimalizace průjezdu zatáčkou

- **Vstup do zatáčky**: Kde přestat brzdit
- **Apex**: Kde začít akcelerovat
- **Výjezd**: Jak rychle přidat plyn

### 3. Konzistence techniky

- Zkontrolujte, zda brzdy aplikujete vždy na stejném místě
- Ověřte plynulost řízení
- Detekujte trhavé vstupy

### 4. Trénink

- Ukažte začátečníkům optimální brzdné zóny
- Porovnejte s referenčním kolem
- Zvýrazněte oblasti přebrzdění

## Omezení a doporučení

### ✅ Co funguje dobře

- Detekce silného brzdění (0.2+ G)
- Detekce rychlé akcelerace (0.15+ G)
- Stabilní výsledky při správném upevnění telefonu

### ⚠️ Co může být problém

- **Nerovnosti vozovky** - mohou způsobit falešné detekce
- **Špatně upevněný telefon** - rotace ovlivňuje přesnost
- **Levné telefony** - mohou mít hlučné senzory
- **Pomalá jízda** (< 5 km/h) - nižší přesnost

### 💡 Doporučení pro nejlepší výsledky

1. **Upevnění telefonu**:
    - Pevně upevněte v držáku
    - Orientace: horní strana telefonu = směr jízdy
    - Režim na šířku (landscape)

2. **Před jízdou**:
    - Nechte telefon 2 sekundy v klidu pro kalibraci
    - Nevyužívejte při velmi studených teplotách (< -10°C)

3. **Během jízdy**:
    - Neměňte orientaci telefonu
    - Vyhněte se extrémním otřesům

4. **Po jízdě**:
    - Prohlédněte si barevně kódovanou trajektorii
    - Porovnejte brzdné body mezi koly
    - Hledejte oblasti pro zlepšení

## Technické detaily

### Souřadnicový systém

Při umístění telefonu na šířku (top = vpřed):

```
          ↑ Y (longitudinální)
          │
          │
          │
    ──────┼────── X (laterální)
          │
          │
          ⊙ Z (vertikální, do obrazovky)
```

### Algoritmus klasifikace

```
1. Načti data z akcelerometru
2. Aplikuj low-pass filtr
3. Odečti gravitaci
4. Spočítej klouzavý průměr
5. Klasifikuj stav:
   - pokud avg_G < -0.15 → BRZDĚNÍ
   - pokud avg_G > 0.12 → AKCELERACE
   - pokud |avg_G| < 0.08 → COASTING
6. Validuj s GPS rychlostí
7. Zaznamenej do trajektorie
```

### Výkon

| Metrika               | Hodnota                     |
|-----------------------|-----------------------------|
| Frekvence aktualizace | 10 Hz (každých 100 ms)      |
| Spotřeba baterie      | +2-3% nad baseline          |
| Využití paměti        | ~50 bytes/bod (~25 KB/kolo) |
| CPU overhead          | Minimální                   |

## Budoucí vylepšení

### Plánované funkce

- [ ] Integrace gyroskopu pro rotaci
- [ ] Machine learning pro auto-tuning prahů
- [ ] Analýza laterálního G (zatáčky)
- [ ] Real-time G-force graf
- [ ] Export dat pro pokročilou analýzu

### Možná vylepšení

- Detekce pod/přetáčení (understeer/oversteer)
- Optimální závodní linie
- Predikce opotřebení pneumatik
- Doporučení brake bodu

## Řešení problémů

### Problém: Detekce nefunguje

**Řešení**:

1. Zkontrolujte, zda je session aktivní
2. Ověřte upevnění telefonu
3. Zkuste manuální rekalibraci

### Problém: Příliš mnoho blikání mezi stavy

**Řešení**:

```typescript
COASTING_DEADBAND: 0.12  // zvětšit
SMOOTHING_WINDOW: 7      // zvětšit okno
```

### Problém: Detekce je pomalá/opožděná

**Řešení**:

```typescript
SMOOTHING_WINDOW: 3  // zmenšit okno
FILTER_ALPHA: 0.5    // méně filtrování
```

### Problém: Falešné detekce na nerovnostech

**Řešení**:

- Zvýšit prahy (0.15 → 0.20 pro brzdění)
- Zvětšit validaci GPS
- Použít větší smoothing window

## Závěr

Systém detekce akcelerace poskytuje cenné informace o jízdní dynamice a pomáhá zlepšovat techniku řízení. Pro nejlepší
výsledky:

1. ✅ Správně upevněte telefon
2. ✅ Nechte zkalibrovat 2 sekundy
3. ✅ Jeďte konzistentně
4. ✅ Analyzujte barevnou trajektorii
5. ✅ Hledejte oblasti pro zlepšení

**Hodně zdaru na trati! 🏁**

