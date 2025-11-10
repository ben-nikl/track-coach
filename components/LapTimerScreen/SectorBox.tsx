import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeProvider';
import { formatLapTime, formatDelta } from './format';

export interface SectorBoxProps {
  index: number; // sector number
  time?: number; // ms
  delta?: number; // ms vs reference (negative = better)
  referenceName?: string; // e.g. 'SECTOR 2'
}

const SectorBox: React.FC<SectorBoxProps> = ({ index, time, delta, referenceName }) => {
  const { colors } = useTheme();
  const colorBar = delta == null ? colors.border : delta < 0 ? colors.success : delta > 0 ? colors.danger : colors.secondaryText;
  const deltaColor = delta == null ? colors.secondaryText : delta < 0 ? colors.success : delta > 0 ? colors.danger : colors.secondaryText;
  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <View style={[styles.colorBar, { backgroundColor: colorBar }]} />
      <View style={styles.body}>
        <Text style={[styles.label, { color: colors.secondaryText }]}>{(referenceName || `SECTOR ${index}`).toUpperCase()}</Text>
        <Text style={[styles.time, { color: colors.text }]}>{formatLapTime(time ?? NaN)}</Text>
        {delta != null && <Text style={[styles.delta, { color: deltaColor }]}>{formatDelta(delta)}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, overflow: 'hidden' },
  colorBar: { width: 4, },
  body: { flex: 1, padding: 10 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  time: { fontSize: 16, fontWeight: '500' },
  delta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});

export default SectorBox;

