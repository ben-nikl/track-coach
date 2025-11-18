import React from 'react';
import {Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../ThemeProvider';
import LapPanel from './LapPanel';
import LapTimeDisplay from './LapTimeDisplay';
import SectorBox from './SectorBox';
import {formatLapTime} from './format';
import {useLapSession} from '../LapSessionContext';

export interface LapTimerScreenProps {
    onBack?: () => void;
    onMenu?: () => void;
}

const LapTimerScreen: React.FC<LapTimerScreenProps> = ({onBack, onMenu}) => {
    const {colors} = useTheme();
    const insets = useSafeAreaInsets();
    const {width, height} = useWindowDimensions();
    const landscape = width > height;

    const {
        trackData,
        permissionError,
        lastLapMs,
        bestLapMs,
        lineDistances,
        toastMessages,
        currentLapElapsedMs,
        lapNumber,
        sectorBoxes,
        ghostLapMs,
        endSession,
        sessionActive,
    } = useLapSession();

    const distancesPanel = lineDistances.length > 0 && (
        <LapPanel title="Distances" style={{marginTop: 8}}>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', rowGap: 4, columnGap: 12}}>
                {lineDistances.map(ld => (
                    <Text key={ld.id} style={{
                        color: colors.secondaryText,
                        fontSize: 12
                    }}>{ld.label}: {ld.distance.toFixed(1)} m</Text>
                ))}
            </View>
        </LapPanel>
    );

    const ToastOverlay = () => (
        <View pointerEvents="none" style={styles.toastContainer}>
            {toastMessages.map(t => (
                <View key={t.id}
                      style={[styles.toast, {backgroundColor: colors.surface, borderColor: colors.border}]}>\n <Text
                    style={{color: colors.text, fontSize: 12, fontWeight: '600'}}>{t.text}</Text>\n </View>
            ))}
        </View>
    );

    const header = (
        <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.headerBtn}><Text
                style={[styles.headerBtnText, {color: colors.text}]}>◄</Text></Pressable>
            <Text style={[styles.trackTitle, {color: colors.text}]}
                  numberOfLines={1}>{trackData ? trackData.name : 'No Track'}</Text>
            <Pressable accessibilityRole="button" onPress={onMenu} style={styles.headerBtn}><Text
                style={[styles.headerBtnText, {color: colors.text}]}>⋮</Text></Pressable>
        </View>
    );

    const endButton = sessionActive && (
        <Pressable onPress={endSession}
                   style={{marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: colors.danger}}>
            <Text style={{color: colors.white, fontWeight: '600'}}>End Session</Text>
        </Pressable>
    );

    if (!trackData) {
        return (
            <SafeAreaView style={[styles.portraitRoot, {
                paddingTop: insets.top + 8,
                paddingBottom: insets.bottom + 16
            }]}>\n {header}\n <Text style={{color: colors.text, marginTop: 24}}>No active session.</Text>\n <Text
                style={{color: colors.secondaryText, marginTop: 8}}>Start a session from track detail
                screen.</Text>\n {permissionError && (<Text style={{
                color: colors.danger,
                textAlign: 'center',
                marginTop: 4
            }}>{permissionError}</Text>)}\n <ToastOverlay/>\n </SafeAreaView>
        );
    }

    const landscapeUI = (
        <SafeAreaView style={[styles.containerLandscape, {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16
        }]}>\n <ToastOverlay/>\n {header}\n <View style={styles.landscapeRow}>\n <View
            style={styles.landscapeLeft}>\n <LapTimeDisplay lastLapMs={lastLapMs ?? undefined}
                                                            lastLapDeltaMs={undefined} lapNumber={lapNumber}/>\n <View
            style={styles.spacer}/>\n <View style={styles.timersContainer}>\n <LapPanel title="Ghost Lap (PB)"
                                                                                        center>\n <Text
            style={[styles.panelMainTime, {color: colors.text}]}>{formatLapTime(ghostLapMs ?? NaN)}</Text>\n
        </LapPanel>\n <LapPanel title="Best Lap" style={styles.bestLapLandscape}>\n <Text
            style={[styles.panelMainTime, {color: colors.secondaryText}]}>{formatLapTime(bestLapMs ?? NaN)}</Text>\n
        </LapPanel>\n </View>\n </View>\n <View style={styles.landscapeRight}>\n <View
            style={styles.sectorsGrid}>\n {sectorBoxes.map(s => <SectorBox key={s.index} index={s.index} time={s.time}
                                                                           active={s.active}/>)}\n </View>\n </View>\n
        </View>\n {currentLapElapsedMs != null && (
            <Text style={{color: colors.accent, textAlign: 'center', marginTop: 8}}>Current
                Lap: {formatLapTime(currentLapElapsedMs)}</Text>)}\n {distancesPanel}\n {permissionError && (<Text
            style={{color: colors.danger, textAlign: 'center', marginTop: 4}}>{permissionError}</Text>)}\n {endButton}\n
        </SafeAreaView>
    );

    const portraitUI = (
        <SafeAreaView style={[styles.portraitRoot, {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16
        }]}>\n {header}\n <LapPanel title="Ghost Lap (PB)"
                                    style={[styles.ghostPortrait, styles.sectionStretch]}>\n <Text
            style={[styles.panelMainTime, {color: colors.text}]}>{formatLapTime(ghostLapMs ?? NaN)}</Text>\n
        </LapPanel>\n <View style={[styles.lastLapPortrait, styles.sectionStretch]}>\n <LapTimeDisplay
            lastLapMs={lastLapMs ?? undefined} lastLapDeltaMs={undefined}
            lapNumber={lapNumber}/>\n {currentLapElapsedMs != null && (<Text style={{
            color: colors.accent,
            marginTop: 8
        }}>Current: {formatLapTime(currentLapElapsedMs)}</Text>)}\n {distancesPanel}\n </View>\n <View
            style={styles.sectorsGridPortrait}>\n {sectorBoxes.map(s => <SectorBox key={s.index} index={s.index}
                                                                                   time={s.time}
                                                                                   active={s.active}/>)}\n </View>\n <LapPanel
            title="Best Lap" style={[styles.bestLapPortrait, styles.sectionStretch]}>\n <Text
            style={[styles.panelMainTime, {color: colors.secondaryText}]}>{formatLapTime(bestLapMs ?? NaN)}</Text>\n
        </LapPanel>\n {permissionError && (<Text style={{
            color: colors.danger,
            textAlign: 'center',
            marginTop: 4
        }}>{permissionError}</Text>)}\n {endButton}\n <ToastOverlay/>\n </SafeAreaView>
    );

    return landscape ? landscapeUI : portraitUI;
};

const styles = StyleSheet.create({
    portraitRoot: {flex: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center'},
    sectionStretch: {alignSelf: 'stretch'},
    containerLandscape: {flex: 1, paddingHorizontal: 18},
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        alignSelf: 'stretch'
    },
    headerBtn: {padding: 6},
    headerBtnText: {fontSize: 18, fontWeight: '600'},
    trackTitle: {fontSize: 16, fontWeight: '700'},
    spacer: {height: 16},
    panelMainTime: {fontSize: 32, fontWeight: '700', textAlign: 'center'},
    ghostPortrait: {
        marginBottom: 32,
        flexDirection: 'column',
        alignContent: 'center',
        justifyContent: 'center',
        alignItems: 'center'
    },
    lastLapPortrait: {marginBottom: 32, alignItems: 'center'},
    sectorsGridPortrait: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 8,
        rowGap: 8,
        marginBottom: 32,
        justifyContent: 'space-between'
    },
    bestLapPortrait: {marginBottom: 64, alignItems: 'center'},
    sectorsGrid: {flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8, justifyContent: 'space-between'},
    landscapeRow: {flex: 1, flexDirection: 'row', columnGap: 32},
    landscapeLeft: {flex: 1, justifyContent: 'space-between'},
    landscapeRight: {flex: 1, justifyContent: 'flex-start'},
    bestLapLandscape: {alignItems: 'center'},
    timersContainer: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16},
    toastContainer: {position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center', zIndex: 20},
    toast: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 14,
        marginBottom: 6,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3
    },
});

export default LapTimerScreen;
