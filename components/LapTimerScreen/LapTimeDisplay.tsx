import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeProvider';
import { formatLapTime, formatDelta } from './format';

interface LapTimeDisplayProps {
  lastLapMs?: number;
  lastLapDeltaMs?: number; // vs ghost/best
}

const LapTimeDisplay: React.FC<LapTimeDisplayProps> = ({ lastLapMs, lastLapDeltaMs }) => {
  const { colors } = useTheme();
  const deltaColor = lastLapDeltaMs == null ? colors.secondaryText : lastLapDeltaMs < 0 ? colors.success : lastLapDeltaMs > 0 ? colors.danger : colors.secondaryText;
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.caption, { color: colors.secondaryText }]}>LAST LAP</Text>
      <Text style={[styles.time, { color: colors.text }]}>{formatLapTime(lastLapMs ?? NaN)}</Text>
      {lastLapDeltaMs != null && (
        <Text style={[styles.delta, { color: deltaColor }]}>{formatDelta(lastLapDeltaMs)}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { alignItems: 'flex-start', justifyContent: 'center' },
  caption: { fontSize: 14, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  time: { fontSize: 64, fontWeight: '800', letterSpacing: -2 },
  delta: { fontSize: 22, fontWeight: '700', marginTop: 4 },
});

export default LapTimeDisplay;

