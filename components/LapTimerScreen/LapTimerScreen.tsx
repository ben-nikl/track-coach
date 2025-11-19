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
    onShowTrackDetail?: () => void;
}

const LapTimerScreen: React.FC<LapTimerScreenProps> = ({onBack, onMenu, onShowTrackDetail}) => {
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

    // Handler for back button - returns to track detail if session active, otherwise calls onBack
    const handleBackPress = () => {
        if (sessionActive && trackData && onShowTrackDetail) {
            onShowTrackDetail();
        } else if (onBack) {
            onBack();
        }
    };

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
                <View key={t.id} style={[styles.toast, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                    <Text style={{color: colors.text, fontSize: 12, fontWeight: '600'}}>{t.text}</Text>
                </View>
            ))}
        </View>
    );

    const header = (
        <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" onPress={handleBackPress} style={styles.headerBtn}>
                <Text style={[styles.headerBtnText, {color: colors.text}]}>◄</Text>
            </Pressable>
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
            <SafeAreaView
                style={[styles.portraitRoot, {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16}]}>
                {header}
                <Text style={{color: colors.text, marginTop: 24}}>No active session.</Text>
                <Text style={{color: colors.secondaryText, marginTop: 8}}>Start a session from track detail
                    screen.</Text>
                {permissionError && (
                    <Text style={{color: colors.danger, textAlign: 'center', marginTop: 4}}>{permissionError}</Text>
                )}
                <ToastOverlay/>
            </SafeAreaView>
        );
    }

    const landscapeUI = (
        <SafeAreaView
            style={[styles.containerLandscape, {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16}]}>
            <ToastOverlay/>
            {header}
            <View style={styles.landscapeRow}>
                <View style={styles.landscapeLeft}>
                    <LapTimeDisplay lastLapMs={lastLapMs ?? undefined} lastLapDeltaMs={undefined}
                                    lapNumber={lapNumber}/>
                    <View style={styles.spacer}/>
                    <View style={styles.timersContainer}>
                        <LapPanel title="Ghost Lap (PB)" center>
                            <Text
                                style={[styles.panelMainTime, {color: colors.text}]}>{formatLapTime(ghostLapMs ?? NaN)}</Text>
                        </LapPanel>
                        <LapPanel title="Best Lap" style={styles.bestLapLandscape}>
                            <Text
                                style={[styles.panelMainTime, {color: colors.secondaryText}]}>{formatLapTime(bestLapMs ?? NaN)}</Text>
                        </LapPanel>
                    </View>
                </View>
                <View style={styles.landscapeRight}>
                    <View style={styles.sectorsGrid}>
                        {sectorBoxes.map(s => (
                            <SectorBox
                                key={s.index}
                                index={s.index}
                                time={s.time}
                                active={s.active}
                                isGhostModeActive={s.isGhostModeActive}
                                isBestOverall={s.isBestOverall}
                                isBestPersonal={s.isBestPersonal}
                            />
                        ))}
                    </View>
                </View>
            </View>
            {currentLapElapsedMs != null && (
                <Text style={{color: colors.accent, textAlign: 'center', marginTop: 8}}>Current
                    Lap: {formatLapTime(currentLapElapsedMs)}</Text>
            )}
            {distancesPanel}
            {permissionError && (
                <Text style={{color: colors.danger, textAlign: 'center', marginTop: 4}}>{permissionError}</Text>
            )}
            {endButton}
        </SafeAreaView>
    );

    const portraitUI = (
        <SafeAreaView style={[styles.portraitRoot, {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16}]}>
            {header}
            <LapPanel title="Ghost Lap (PB)" style={[styles.ghostPortrait, styles.sectionStretch]}>
                <Text style={[styles.panelMainTime, {color: colors.text}]}>{formatLapTime(ghostLapMs ?? NaN)}</Text>
            </LapPanel>
            <View style={[styles.lastLapPortrait, styles.sectionStretch]}>
                <LapTimeDisplay lastLapMs={lastLapMs ?? undefined} lastLapDeltaMs={undefined} lapNumber={lapNumber}/>
                {currentLapElapsedMs != null && (
                    <Text style={{
                        color: colors.accent,
                        marginTop: 8
                    }}>Current: {formatLapTime(currentLapElapsedMs)}</Text>
                )}
                {distancesPanel}
            </View>
            <View style={styles.sectorsGridPortrait}>
                {sectorBoxes.map(s => (
                    <SectorBox
                        key={s.index}
                        index={s.index}
                        time={s.time}
                        active={s.active}
                        isGhostModeActive={s.isGhostModeActive}
                        isBestOverall={s.isBestOverall}
                        isBestPersonal={s.isBestPersonal}
                    />
                ))}
            </View>
            <LapPanel title="Best Lap" style={[styles.bestLapPortrait, styles.sectionStretch]}>
                <Text
                    style={[styles.panelMainTime, {color: colors.secondaryText}]}>{formatLapTime(bestLapMs ?? NaN)}</Text>
            </LapPanel>
            {permissionError && (
                <Text style={{color: colors.danger, textAlign: 'center', marginTop: 4}}>{permissionError}</Text>
            )}
            {endButton}
            <ToastOverlay/>
        </SafeAreaView>
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
