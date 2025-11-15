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
  const colorBar = delta == null ? colors.border : delta < 0 ? colors.danger : delta > 0 ? colors.warning : colors.doveGray;
  const deltaColor = delta == null ? colors.secondaryText : delta < 0 ? colors.warning : delta > 0 ? colors.danger : colors.secondaryText;

  return (
      <View style={[styles.container, {borderColor:colors.border, backgroundColor:colors.mineShaft20} ]}>
        <View style={[styles.colorBar, { backgroundColor: colorBar }]} />
        <View style={styles.secondColumn}>
          <Text style={[styles.label, { color: colors.doveGray }]}>{(referenceName || `SECTOR ${index}`).toUpperCase()}</Text>
          <Text style={[styles.time, { color: colors.text }]}>{formatLapTime(time ?? NaN)}</Text>
        </View>
        {delta != null && <Text style={[styles.delta, { color: deltaColor }]}>{formatDelta(delta)}</Text>}


      </View>
  )
};


const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems:"center", justifyContent:'space-between', borderWidth: 1, borderRadius: 10, overflow: 'hidden', height:100, padding:8, gap: 6, width:'50%', maxWidth:'48%', minWidth:'42%'},
  colorBar: { alignSelf: "stretch", width: 6, borderRadius: 10 },
  secondColumn: {flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', alignSelf:"stretch", padding:2},
  label: { fontSize: 14, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4},
  time: { fontSize: 18, fontWeight: '700' },
  delta: { fontSize: 18, fontWeight: '600'},
});

export default SectorBox;

