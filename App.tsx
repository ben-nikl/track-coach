import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BottomMenu from './components/BottomMenu';
import StatsScreen from './components/StatsScreen';
import TrackListScreen from './components/TrackListScreen';
import SettingsScreen from './components/SettingsScreen';
import { ThemeProvider, useTheme } from './ThemeProvider';

const AppContent: React.FC = () => {
  const [selected, setSelected] = useState('home');
  const { colors, mode } = useTheme();
  const items = [
    { id: 'home', label: 'Home' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'tracks', label: 'Tracks' },
    { id: 'stats', label: 'Stats' },
    { id: 'settings', label: 'Settings' },
  ];
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={selected === 'stats' ? styles.contentStats : styles.content}>
        {selected === 'stats' ? (
          <StatsScreen />
        ) : selected === 'tracks' ? (
          <TrackListScreen />
        ) : selected === 'settings' ? (
          <SettingsScreen />
        ) : (
          <View style={styles.center}>
            <Text style={[styles.title, { color: colors.text }]}>{selected.toUpperCase()}</Text>
            <Text style={{ color: colors.secondaryText }}>Welcome. Select an item from the menu.</Text>
          </View>
        )}
      </View>
      <BottomMenu items={items} selectedId={selected} onSelect={setSelected} />
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </View>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
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
