import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../ThemeProvider';
import {formatDelta, formatLapTime} from './format';

export interface SectorBoxProps {
    index: number; // sector number
    time?: number; // ms
    referenceName?: string; // e.g. 'SECTOR 2'
    active?: boolean; // highlight current sector
    isGhostModeActive?: boolean; // whether ghost mode is active
    isBestOverall?: boolean; // best time among all participants in this sector
    isBestPersonal?: boolean; // best personal time in this sector
    currentSectorTimeMs?: number; // current elapsed time in this active sector
    bestSectorTime?: number; // best time in this sector for calculating delta
}

const SectorBox: React.FC<SectorBoxProps> = ({
                                                 index,
                                                 time,
                                                 referenceName,
                                                 active,
                                                 isGhostModeActive,
                                                 isBestOverall,
                                                 isBestPersonal,
                                                 currentSectorTimeMs,
                                                 bestSectorTime
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

    // Vypočítat deltu od best času v tomto sektoru
    const calculatedDelta = time != null && bestSectorTime != null ? time - bestSectorTime : null;

    // Barva delta textu má stejnou logiku jako colorBar
    let deltaTextColor: string;
    if (isGhostModeActive && isBestOverall) {
        deltaTextColor = colors.danger; // červená - nejlepší ze všech
    } else if (isBestPersonal) {
        deltaTextColor = colors.warning; // oranžová - nejlepší osobní
    } else {
        deltaTextColor = colors.doveGray; // šedá - jinak
    }

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
            {active && currentSectorTimeMs != null ? (
                <Text style={[styles.delta, {color: colors.accent}]}>{formatLapTime(currentSectorTimeMs)}</Text>
            ) : calculatedDelta != null ? (
                <Text style={[styles.delta, {color: deltaTextColor}]}>{formatDelta(calculatedDelta)}</Text>
            ) : null}
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
    time: {fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums']},
    delta: {fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums']},
});

export default SectorBox;
