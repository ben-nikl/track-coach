import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeProvider';
import { formatLapTime, formatDelta } from './format';

interface LapTimeDisplayProps {
  lastLapMs?: number;
  lastLapDeltaMs?: number; // vs ghost/best
  lapNumber: number;
}

const LapTimeDisplay: React.FC<LapTimeDisplayProps> = (props: LapTimeDisplayProps) => {
  const { colors } = useTheme();
  const deltaColor = props.lastLapDeltaMs == null ? colors.secondaryText : props.lastLapDeltaMs < 0 ? colors.danger : props.lastLapDeltaMs > 0 ? colors.danger : colors.secondaryText;
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.caption, { color: colors.secondaryText }]}>LAST LAP ({props.lapNumber ?? NaN })</Text>
      <Text style={[styles.time, { color: colors.text }]}>{formatLapTime(props.lastLapMs ?? NaN)}</Text>
      {props.lastLapDeltaMs != null && (
        <Text style={[styles.delta, { color: deltaColor }]}>{formatDelta(props.lastLapDeltaMs)}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 14, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  time: { fontSize: 64, fontWeight: '800', letterSpacing: -2, textAlign: 'center' },
  delta: { fontSize: 22, fontWeight: '700', marginTop: 4, textAlign: 'center' },
});

export default LapTimeDisplay;
