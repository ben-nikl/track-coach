/**
 * Session Detail Screen
 *
 * Displays detailed statistics and lap table for a completed session
 */

import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../ThemeProvider';
import {SessionRecord} from '../helpers/sessionStorageTypes';
import {calculateSessionSummary, loadSession} from '../helpers/sessionStorage';
import {formatLapTime} from './LapTimerScreen/format';

interface SessionDetailScreenProps {
    sessionId: string;
}

const SessionDetailScreen: React.FC<SessionDetailScreenProps> = ({sessionId}) => {
    const {colors} = useTheme();
    const [session, setSession] = useState<SessionRecord | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSessionData();
    }, [sessionId]);

    const loadSessionData = async () => {
        setLoading(true);
        try {
            const loadedSession = await loadSession(sessionId);
            setSession(loadedSession);
        } catch (error) {
            console.error('Failed to load session:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, {backgroundColor: colors.background}]}>
                <Text style={[styles.loadingText, {color: colors.secondaryText}]}>Loading session...</Text>
            </View>
        );
    }

    if (!session) {
        return (
            <View style={[styles.container, {backgroundColor: colors.background}]}>
                <Text style={[styles.errorText, {color: colors.danger}]}>Session not found</Text>
            </View>
        );
    }

    const summary = calculateSessionSummary(session);
    const bestLapIndex = session.laps.findIndex(lap => lap.lapTimeMs === session.bestLapTimeMs);

    // Find best time for each sector across all laps
    const numSectors = session.laps[0]?.sectorSplitsMs.length || 0;
    const bestSectorTimes = summary.optimalSectorTimes;

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('cs-CZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <ScrollView style={[styles.container, {backgroundColor: colors.background}]}
                    contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, {color: colors.text}]}>{session.trackName}</Text>
                <Text style={[styles.subtitle, {color: colors.secondaryText}]}>{formatDate(session.startTime)}</Text>
            </View>

            {/* Summary Statistics */}
            <View style={styles.summaryGrid}>
                <View style={[styles.summaryCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                    <Text style={[styles.summaryLabel, {color: colors.secondaryText}]}>Laps</Text>
                    <Text style={[styles.summaryValue, {color: colors.text}]}>{summary.totalLaps}</Text>
                </View>

                <View style={[styles.summaryCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                    <Text style={[styles.summaryLabel, {color: colors.secondaryText}]}>Time</Text>
                    <Text
                        style={[styles.summaryValue, {color: colors.text}]}>{formatLapTime(summary.totalTimeMs)}</Text>
                </View>

                <View style={[styles.summaryCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                    <Text style={[styles.summaryLabel, {color: colors.secondaryText}]}>Distance</Text>
                    <Text
                        style={[styles.summaryValue, {color: colors.text}]}>{summary.totalDistanceKm.toFixed(1)} km</Text>
                </View>

                <View style={[styles.summaryCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                    <Text style={[styles.summaryLabel, {color: colors.secondaryText}]}>Best Lap</Text>
                    <Text
                        style={[styles.summaryValue, {color: colors.warning}]}>{formatLapTime(summary.bestLapTimeMs)}</Text>
                </View>
            </View>

            {/* Optimal Lap */}
            <View style={[styles.optimalLapCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <View style={styles.optimalLapHeader}>
                    <Text style={[styles.optimalLapLabel, {color: colors.secondaryText}]}>Optimal Lap</Text>
                    <Text
                        style={[styles.optimalLapTime, {color: colors.accent}]}>{formatLapTime(summary.optimalLapTimeMs)}</Text>
                </View>
                <View style={styles.optimalSectors}>
                    {bestSectorTimes.map((time, idx) => (
                        <View key={idx} style={styles.optimalSectorItem}>
                            <Text style={[styles.optimalSectorLabel, {color: colors.secondaryText}]}>S{idx + 1}</Text>
                            <Text
                                style={[styles.optimalSectorTime, {color: colors.warning}]}>{formatLapTime(time)}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Lap Table */}
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Lap Times</Text>
            <View style={[styles.table, {borderColor: colors.border}]}>
                {/* Table Header */}
                <View style={[styles.tableRow, styles.tableHeader, {backgroundColor: colors.surface}]}>
                    <Text style={[styles.tableHeaderText, {color: colors.secondaryText}]}>#</Text>
                    <Text style={[styles.tableHeaderText, {color: colors.secondaryText}]}>Lap Time</Text>
                    {Array.from({length: numSectors}, (_, i) => (
                        <Text key={i} style={[styles.tableHeaderText, {color: colors.secondaryText}]}>S{i + 1}</Text>
                    ))}
                </View>

                {/* Table Rows */}
                {session.laps.map((lap, idx) => {
                    const isBestLap = idx === bestLapIndex;
                    return (
                        <View key={lap.lapIndex}
                              style={[styles.tableRow, {backgroundColor: idx % 2 ? colors.background : 'transparent'}]}>
                            <Text style={[styles.tableCell, {color: colors.text}]}>{lap.lapIndex}</Text>
                            <Text style={[
                                styles.tableCell,
                                {
                                    color: isBestLap ? colors.warning : colors.text,
                                    fontWeight: isBestLap ? '700' : '400',
                                    backgroundColor: isBestLap ? colors.warning + '22' : 'transparent',
                                    borderRadius: 4,
                                    paddingHorizontal: 4,
                                }
                            ]}>
                                {formatLapTime(lap.lapTimeMs)}
                            </Text>
                            {lap.sectorSplitsMs.map((sectorTime, sectorIdx) => {
                                const isBestSector = sectorTime === bestSectorTimes[sectorIdx];
                                return (
                                    <Text
                                        key={sectorIdx}
                                        style={[
                                            styles.tableCell,
                                            {
                                                color: isBestSector ? colors.warning : colors.text,
                                                fontWeight: isBestSector ? '700' : '400',
                                                backgroundColor: isBestSector ? colors.warning + '22' : 'transparent',
                                                borderRadius: 4,
                                                paddingHorizontal: 4,
                                            }
                                        ]}
                                    >
                                        {formatLapTime(sectorTime)}
                                    </Text>
                                );
                            })}
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 100,
    },
    header: {
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    summaryCard: {
        flex: 1,
        minWidth: '45%',
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
    },
    summaryLabel: {
        fontSize: 12,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    optimalLapCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 24,
    },
    optimalLapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    optimalLapLabel: {
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    optimalLapTime: {
        fontSize: 24,
        fontWeight: '700',
    },
    optimalSectors: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    optimalSectorItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    optimalSectorLabel: {
        fontSize: 12,
    },
    optimalSectorTime: {
        fontSize: 16,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    table: {
        borderWidth: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    tableHeader: {
        borderBottomWidth: 1,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    tableHeaderText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
        textAlign: 'center',
    },
    loadingText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
    errorText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
});

export default SessionDetailScreen;

