import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
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
  sectors = [
    { index: 1, time: 30981, delta: -21 },
    { index: 2, time: 30981, delta: 21 },
    { index: 3, time: 30981, delta: -21 },
    { index: 4, time: 30981, delta: 0 },
  ],
  onBack,
  onMenu,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  if (landscape) {
    return (
      <SafeAreaView style={[styles.containerLandscape, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.headerBtn}><Text style={[styles.headerBtnText, { color: colors.text }]}>◄</Text></Pressable>
          <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>{trackName}</Text>
          <Pressable accessibilityRole="button" onPress={onMenu} style={styles.headerBtn}><Text style={[styles.headerBtnText, { color: colors.text }]}>⋮</Text></Pressable>
        </View>
        <View style={styles.landscapeRow}>
          <View style={styles.landscapeLeft}>
            <LapTimeDisplay lastLapMs={lastLapMs} lastLapDeltaMs={lastLapDeltaMs}  lapNumber={lapNumber}/>
            <View style={styles.spacer} />
            <View style={styles.timersContainer}>
              <LapPanel title="Ghost Lap (PB)" center>
                <Text style={[styles.panelMainTime, { color: colors.text }]}>{formatLapTime(ghostLapMs)}</Text>
              </LapPanel>
              <LapPanel title="Best Lap" style={styles.bestLapLandscape}>
                <Text style={[styles.panelMainTime, { color: colors.secondaryText }]}>{formatLapTime(bestLapMs)}</Text>
              </LapPanel>
            </View>
          </View>
          <View style={styles.landscapeRight}>
            <View style={styles.sectorsGrid}>
              {sectors.map(s => (
                <SectorBox key={s.index} {...s} />
              ))}
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Portrait layout (non-scrollable)
  return (
    <SafeAreaView style={[styles.portraitRoot, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.headerBtn}><Text style={[styles.headerBtnText, { color: colors.text }]}>◄</Text></Pressable>
        <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>{trackName}</Text>
        <Pressable accessibilityRole="button" onPress={onMenu} style={styles.headerBtn}><Text style={[styles.headerBtnText, { color: colors.text }]}>⋮</Text></Pressable>
      </View>
      <LapPanel title="Ghost Lap (PB)" style={[styles.ghostPortrait, styles.sectionStretch]}>
        <Text style={[styles.panelMainTime, { color: colors.text }]}>{formatLapTime(ghostLapMs)}</Text>
      </LapPanel>
      <View style={[styles.lastLapPortrait, styles.sectionStretch]}>
        <LapTimeDisplay lastLapMs={lastLapMs} lastLapDeltaMs={lastLapDeltaMs}  lapNumber={lapNumber}/>
      </View>
      <View style={[styles.sectorsGridPortrait]}>
        {sectors.map(s => (
            <SectorBox key={s.index} {...s} />
        ))}
      </View>
      <LapPanel title="Best Lap" style={[styles.bestLapPortrait, styles.sectionStretch]}>
        <Text style={[styles.panelMainTime, { color: colors.secondaryText }]}>{formatLapTime(bestLapMs)}</Text>
      </LapPanel>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  portraitRoot: { flex: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  sectionStretch: { alignSelf: 'stretch' },
  // Landscape container
  containerLandscape: { flex: 1, paddingHorizontal: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, alignSelf: 'stretch' },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 18, fontWeight: '600' },
  trackTitle: { fontSize: 16, fontWeight: '700' },
  spacer: { height: 16 },
  panelMainTime: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  ghostPortrait: { marginBottom: 32, flexDirection: 'column', alignContent: 'center', justifyContent: 'center', alignItems: 'center' },
  lastLapPortrait: { marginBottom: 32, alignItems: 'center' },
  lapCounter: { marginTop: 12, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  sectorsGridPortrait: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8, marginBottom: 32, justifyContent:'space-between' },
  bestLapPortrait: { marginBottom: 64, alignItems: 'center' },
  sectorsGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8, justifyContent:'space-between'  },
  landscapeRow: { flex: 1, flexDirection: 'row', columnGap: 32 },
  landscapeLeft: { flex: 1, justifyContent: 'space-between' },
  landscapeRight: { flex: 1, justifyContent: 'flex-start' },
  bestLapLandscape: {  alignItems: 'center' },
  timersContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap:16 },
});

export default LapTimerScreen;
