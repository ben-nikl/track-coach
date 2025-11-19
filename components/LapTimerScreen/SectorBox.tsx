import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../ThemeProvider';
import {formatDelta, formatLapTime} from './format';

export interface SectorBoxProps {
    index: number; // sector number
    time?: number; // ms
    delta?: number; // ms vs reference (negative = better)
    referenceName?: string; // e.g. 'SECTOR 2'
    active?: boolean; // highlight current sector
    isGhostModeActive?: boolean; // whether ghost mode is active
    isBestOverall?: boolean; // best time among all participants in this sector
    isBestPersonal?: boolean; // best personal time in this sector
}

const SectorBox: React.FC<SectorBoxProps> = ({
                                                 index,
                                                 time,
                                                 delta,
                                                 referenceName,
                                                 active,
                                                 isGhostModeActive,
                                                 isBestOverall,
                                                 isBestPersonal
                                             }) => {
    const {colors} = useTheme();

    // Logika pro colorBar: červená pokud ghost mode a nejlepší overall, oranžová pokud nejlepší personal, jinak šedá
    let colorBar: string;
    if (isGhostModeActive && isBestOverall) {
        colorBar = colors.danger; // červená - nejlepší ze všech
    } else if (isBestPersonal) {
        colorBar = colors.warning; // oranžová - nejlepší osobní
    } else {
        colorBar = colors.doveGray; // šedá - jinak
    }

    const deltaColor = delta == null ? colors.secondaryText : delta < 0 ? colors.warning : delta > 0 ? colors.danger : colors.secondaryText;
    const baseBg = (colors as any).mineShaft20 || colors.surface;
    const activeStyles = active ? {borderColor: colors.accent, backgroundColor: colors.accent + '22'} : {};
    return (
        <View style={[styles.container, {borderColor: colors.border, backgroundColor: baseBg}, activeStyles]}>
            <View style={[styles.colorBar, {backgroundColor: colorBar}]}/>
            <View style={styles.secondColumn}>
                <Text
                    style={[styles.label, {color: active ? colors.accent : colors.doveGray}]}>{(referenceName || `SECTOR ${index}`).toUpperCase()}</Text>
                <Text style={[styles.time, {color: colors.text}]}>{formatLapTime(time ?? NaN)}</Text>
            </View>
            {delta != null && <Text style={[styles.delta, {color: deltaColor}]}>{formatDelta(delta)}</Text>}
        </View>
    );
};


const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: "center",
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 10,
        overflow: 'hidden',
        height: 100,
        padding: 8,
        gap: 6,
        width: '50%',
        maxWidth: '48%',
        minWidth: '42%'
    },
    colorBar: {alignSelf: "stretch", width: 6, borderRadius: 10},
    secondColumn: {
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        alignSelf: "stretch",
        padding: 2
    },
    label: {fontSize: 14, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4},
    time: {fontSize: 18, fontWeight: '700'},
    delta: {fontSize: 18, fontWeight: '600'},
});

export default SectorBox;
