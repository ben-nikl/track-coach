import React from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useLapSession} from './LapSessionContext';
import {useTheme} from '../ThemeProvider';
import {formatLapTime} from './LapTimerScreen/format';

const SessionLogScreen: React.FC = () => {
    const {events, laps, resetSession} = useLapSession();
    const {colors} = useTheme();

    return (
        <ScrollView style={[styles.root, {backgroundColor: colors.background}]} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <Text style={[styles.title, {color: colors.text}]}>Session Logs</Text>
                <TouchableOpacity onPress={resetSession} style={[styles.resetBtn, {backgroundColor: colors.primary}]}>
                    <Text style={{color: colors.white, fontWeight: '700'}}>Reset</Text>
                </TouchableOpacity>
            </View>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Crossing Events</Text>
            <View style={[styles.table, {borderColor: colors.border}]}>
                <View style={styles.row}>
                    <Text style={[styles.th, {color: colors.secondaryText}]}>#</Text>
                    <Text style={[styles.th, {color: colors.secondaryText}]}>Type</Text>
                    <Text style={[styles.th, {color: colors.secondaryText}]}>Lap</Text>
                    <Text style={[styles.th, {color: colors.secondaryText}]}>Sector</Text>
                    <Text style={[styles.th, {color: colors.secondaryText}]}>Lap Elapsed</Text>
                    <Text style={[styles.th, {color: colors.secondaryText}]}>Split</Text>
                    <Text style={[styles.th, {color: colors.secondaryText, flex: 2}]}>Wall Time</Text>
                </View>
                {events.map((e, idx) => (
                    <View key={e.id} style={[styles.row, {backgroundColor: idx % 2 ? colors.surface : 'transparent'}]}>
                        <Text style={[styles.td, {color: colors.text}]}>{idx + 1}</Text>
                        <Text style={[styles.td, {color: colors.text}]}>{e.type}</Text>
                        <Text style={[styles.td, {color: colors.text}]}>{e.lapIndex}</Text>
                        <Text
                            style={[styles.td, {color: colors.text}]}>{e.type === 'sector' ? e.sectorIndex : ''}</Text>
                        <Text style={[styles.td, {color: colors.text}]}>{formatLapTime(e.lapElapsedMs ?? NaN)}</Text>
                        <Text
                            style={[styles.td, {color: colors.text}]}>{e.splitMs != null ? formatLapTime(e.splitMs) : ''}</Text>
                        <Text style={[styles.td, {color: colors.secondaryText, flex: 2}]}
                              numberOfLines={1}>{e.wallClockISO}</Text>
                    </View>
                ))}
            </View>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Lap Summary</Text>
            <View style={[styles.table, {borderColor: colors.border}]}>
                <View style={styles.row}>
                    <Text style={[styles.th, {color: colors.secondaryText}]}>Lap</Text>
                    <Text style={[styles.th, {color: colors.secondaryText}]}>Lap Time</Text>
                    <Text style={[styles.th, {color: colors.secondaryText, flex: 2}]}>Sector Splits</Text>
                </View>
                {laps.map(l => (
                    <View key={l.lapIndex}
                          style={[styles.row, {backgroundColor: l.lapIndex % 2 ? colors.surface : 'transparent'}]}>
                        <Text style={[styles.td, {color: colors.text}]}>{l.lapIndex}</Text>
                        <Text style={[styles.td, {color: colors.text}]}>{formatLapTime(l.lapTimeMs)}</Text>
                        <Text style={[styles.td, {
                            color: colors.secondaryText,
                            flex: 2
                        }]}>{l.sectorSplitsMs.map(s => formatLapTime(s)).join(' | ')}</Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    root: {flex: 1},
    content: {padding: 16, paddingBottom: 80},
    headerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12},
    title: {fontSize: 22, fontWeight: '700'},
    resetBtn: {paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8},
    sectionTitle: {fontSize: 18, fontWeight: '600', marginTop: 24, marginBottom: 8},
    table: {borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 12},
    row: {flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', columnGap: 8},
    th: {flex: 1, fontSize: 12, fontWeight: '700'},
    td: {flex: 1, fontSize: 12},
});

export default SessionLogScreen;

