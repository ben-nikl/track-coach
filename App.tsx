import {StatusBar} from 'expo-status-bar';
import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import BottomMenu from './components/BottomMenu';
import StatsScreen from './components/StatsScreen';
import TrackListScreen from './components/TrackListScreen';
import SettingsScreen from './components/SettingsScreen';
import LapTimerScreen from './components/LapTimerScreen/LapTimerScreen';
import {ThemeProvider, useTheme} from './ThemeProvider';
import {LapSessionProvider} from './components/LapSessionContext';
import SessionsScreen from './components/SessionsScreen';
import SessionDetailScreen from './components/SessionDetailScreen';

const AppContent: React.FC = () => {
    const [selected, setSelected] = useState('home');
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const {colors, mode} = useTheme();
    const items = [
        {id: 'home', label: 'Home'},
        {id: 'lap', label: 'Lap'},
        {id: 'sessions', label: 'Sessions'},
        {id: 'tracks', label: 'Tracks'},
        {id: 'stats', label: 'Stats'},
        {id: 'settings', label: 'Settings'},
    ];

    const handleSelectSession = (sessionId: string) => {
        setSelectedSessionId(sessionId);
    };

    const handleBackFromSessionDetail = () => {
        setSelectedSessionId(null);
    };

    return (
        <View style={[styles.container, {backgroundColor: colors.background}]}>
            <View style={selected === 'stats' ? styles.contentStats : styles.content}>
                {selected === 'stats' ? (
                    <StatsScreen/>
                ) : selected === 'tracks' ? (
                    <TrackListScreen onStartSession={() => {
                        setSelected('lap');
                    }}/>
                ) : selected === 'sessions' ? (
                    selectedSessionId ? (
                        <SessionDetailScreen
                            sessionId={selectedSessionId}
                            onBack={handleBackFromSessionDetail}
                        />
                    ) : (
                        <SessionsScreen onSelectSession={handleSelectSession}/>
                    )
                ) : selected === 'settings' ? (
                    <SettingsScreen/>
                ) : selected === 'lap' ? (
                    <LapTimerScreen
                        onBack={() => setSelected('tracks')}
                        onShowTrackDetail={() => setSelected('tracks')}
                    />
                ) : (
                    <View style={styles.center}>
                        <Text style={[styles.title, {color: colors.text}]}>{selected.toUpperCase()}</Text>
                        <Text style={{color: colors.secondaryText}}>Welcome. Select an item from the menu.</Text>
                    </View>
                )}
            </View>
            <BottomMenu items={items} selectedId={selected} onSelect={(id) => {
                setSelected(id);
                setSelectedSessionId(null); // Reset session detail when changing tabs
            }}/>
            <StatusBar style={mode === 'dark' ? 'light' : 'dark'}/>
        </View>
    );
};

export default function App() {
    return (
        <ThemeProvider>
            <LapSessionProvider>
                <SafeAreaProvider>
                    <AppContent/>
                </SafeAreaProvider>
            </LapSessionProvider>
        </ThemeProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        alignSelf: 'stretch',
    },
    contentStats: {
        flex: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 8,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
});
