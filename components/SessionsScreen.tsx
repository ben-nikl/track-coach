/**
 * Sessions Screen
 *
 * Displays list of all completed sessions with summary info
 */

import React, {useEffect, useState} from 'react';
import {FlatList, Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from '../ThemeProvider';
import {SessionListItem} from '../helpers/sessionStorageTypes';
import {loadAllSessions} from '../helpers/sessionStorage';
import {formatLapTime} from './LapTimerScreen/format';
import {TRACKS} from '../data/tracks';

interface SessionsScreenProps {
    onSelectSession: (sessionId: string) => void;
}

const SessionsScreen: React.FC<SessionsScreenProps> = ({onSelectSession}) => {
    const {colors} = useTheme();
    const [sessions, setSessions] = useState<SessionListItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        setLoading(true);
        try {
            const loadedSessions = await loadAllSessions();
            // Attach track flags
            const sessionsWithFlags = loadedSessions.map(session => {
                const track = TRACKS.find(t => t.id === session.trackId);
                return {
                    ...session,
                    trackFlag: track?.flag,
                };
            });
            setSessions(sessionsWithFlags);
        } catch (error) {
            console.error('Failed to load sessions:', error);
        } finally {
            setLoading(false);
        }
    };

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

    const renderSessionItem = ({item}: { item: SessionListItem }) => (
        <TouchableOpacity
            style={[styles.sessionItem, {backgroundColor: colors.surface, borderColor: colors.border}]}
            onPress={() => onSelectSession(item.id)}
        >
            <View style={styles.sessionHeader}>
                {item.trackFlag && <Image source={item.trackFlag} style={styles.flag}/>}
                <View style={styles.trackInfo}>
                    <Text style={[styles.trackName, {color: colors.text}]}>{item.trackName}</Text>
                    <Text style={[styles.trackLocation, {color: colors.secondaryText}]}>{item.trackLocation}</Text>
                </View>
            </View>

            <View style={styles.sessionMeta}>
                <Text style={[styles.sessionDate, {color: colors.secondaryText}]}>
                    {formatDate(item.startTime)}
                </Text>
            </View>

            <View style={styles.sessionStats}>
                <View style={styles.statItem}>
                    <Text style={[styles.statLabel, {color: colors.secondaryText}]}>Laps</Text>
                    <Text style={[styles.statValue, {color: colors.text}]}>{item.totalLaps}</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statLabel, {color: colors.secondaryText}]}>Best Lap</Text>
                    <Text style={[styles.statValue, {color: colors.warning}]}>
                        {formatLapTime(item.bestLapTimeMs)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.container, {backgroundColor: colors.background}]}>
                <Text style={[styles.loadingText, {color: colors.secondaryText}]}>Loading sessions...</Text>
            </View>
        );
    }

    if (sessions.length === 0) {
        return (
            <View style={[styles.container, {backgroundColor: colors.background}]}>
                <View style={styles.emptyState}>
                    <Text style={[styles.emptyTitle, {color: colors.text}]}>No Sessions Yet</Text>
                    <Text style={[styles.emptyText, {color: colors.secondaryText}]}>
                        Complete a session to see it here
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, {backgroundColor: colors.background}]}>
            <FlatList
                data={sessions}
                renderItem={renderSessionItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    sessionItem: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    sessionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    flag: {
        width: 40,
        height: 30,
        borderRadius: 4,
        marginRight: 12,
    },
    trackInfo: {
        flex: 1,
    },
    trackName: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 2,
    },
    trackLocation: {
        fontSize: 14,
    },
    sessionMeta: {
        marginBottom: 12,
    },
    sessionDate: {
        fontSize: 14,
    },
    sessionStats: {
        flexDirection: 'row',
        gap: 20,
    },
    statItem: {
        flex: 1,
    },
    statLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    loadingText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
    },
});

export default SessionsScreen;

