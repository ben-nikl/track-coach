import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../ThemeProvider';
import LapPanel from './LapPanel';
import LapTimeDisplay from './LapTimeDisplay';
import SectorBox, { SectorBoxProps } from './SectorBox';
import { formatLapTime } from './format';

export interface LapTimerScreenProps {
  trackName: string;
  ghostLapMs?: number;
  bestLapMs?: number;
  lastLapMs?: number;
  lastLapDeltaMs?: number;
  lapNumber?: number;
  totalLaps?: number;
  sectors?: SectorBoxProps[]; // pass index/time/delta
  onBack?: () => void;
  onMenu?: () => void;
}

const LapTimerScreen: React.FC<LapTimerScreenProps> = ({
  trackName,
  ghostLapMs = 92456,
  bestLapMs = 91421,
  lastLapMs = 92000,
  lastLapDeltaMs = -456,
  lapNumber = 5,
  totalLaps = 20,
  sectors = [
    { index: 1, time: 30981, delta: -21 },
    { index: 2, time: 30981, delta: 21 },
    { index: 3, time: 30981, delta: -21 },
    { index: 4, time: 30981, delta: 21 },
  ],
  onBack,
  onMenu,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  // Layout containers
  if (landscape) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.headerBtn}><Text style={[styles.headerBtnText, { color: colors.text }]}>◄</Text></Pressable>
          <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>{trackName}</Text>
          <Pressable accessibilityRole="button" onPress={onMenu} style={styles.headerBtn}><Text style={[styles.headerBtnText, { color: colors.text }]}>⋮</Text></Pressable>
        </View>
        <View style={styles.landscapeRow}>
          <View style={styles.landscapeLeft}>
            <LapTimeDisplay lastLapMs={lastLapMs} lastLapDeltaMs={lastLapDeltaMs} />
            <View style={styles.spacer} />
            <LapPanel title="Ghost Lap (PB)">
              <Text style={[styles.panelMainTime, { color: colors.text }]}>{formatLapTime(ghostLapMs)}</Text>
            </LapPanel>
          </View>
          <View style={styles.landscapeRight}>
            <View style={styles.sectorsGrid}>
              {sectors.map(s => (
                <SectorBox key={s.index} {...s} />
              ))}
            </View>
            <LapPanel title="Best Lap" style={styles.bestLapLandscape}>
              <Text style={[styles.panelMainTime, { color: colors.secondaryText }]}>{formatLapTime(bestLapMs)}</Text>
            </LapPanel>
          </View>
        </View>
      </View>
    );
  }

  // Portrait layout
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.headerBtn}><Text style={[styles.headerBtnText, { color: colors.text }]}>◄</Text></Pressable>
        <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>{trackName}</Text>
        <Pressable accessibilityRole="button" onPress={onMenu} style={styles.headerBtn}><Text style={[styles.headerBtnText, { color: colors.text }]}>⋮</Text></Pressable>
      </View>
      <LapPanel title="Ghost Lap (PB)" style={styles.ghostPortrait}>
        <Text style={[styles.panelMainTime, { color: colors.text }]}>{formatLapTime(ghostLapMs)}</Text>
      </LapPanel>
      <View style={styles.lastLapPortrait}>
        <LapTimeDisplay lastLapMs={lastLapMs} lastLapDeltaMs={lastLapDeltaMs} />
        <Text style={[styles.lapCounter, { color: colors.success }]}>Lap {lapNumber} / {totalLaps}</Text>
      </View>
      <View style={styles.sectorsGridPortrait}>
        {sectors.map(s => (
          <SectorBox key={s.index} {...s} />
        ))}
      </View>
      <LapPanel title="Best Lap" style={styles.bestLapPortrait}>
        <Text style={[styles.panelMainTime, { color: colors.secondaryText }]}>{formatLapTime(bestLapMs)}</Text>
      </LapPanel>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 18, fontWeight: '600' },
  trackTitle: { fontSize: 16, fontWeight: '700' },
  spacer: { height: 16 },
  panelMainTime: { fontSize: 32, fontWeight: '700' },
  ghostPortrait: { marginBottom: 32 },
  lastLapPortrait: { marginBottom: 32 },
  lapCounter: { marginTop: 12, fontSize: 14, fontWeight: '600' },
  sectorsGridPortrait: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 14, marginBottom: 32 },
  bestLapPortrait: { marginBottom: 64 },
  sectorsGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 14 },
  landscapeRow: { flex: 1, flexDirection: 'row', columnGap: 32 },
  landscapeLeft: { flex: 1, justifyContent: 'flex-start' },
  landscapeRight: { flex: 1, justifyContent: 'flex-start' },
  bestLapLandscape: { marginTop: 24, alignSelf: 'flex-start' },
});

export default LapTimerScreen;

