import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, ThemePreference } from '../ThemeProvider';

const PREFS: ThemePreference[] = ['system', 'light', 'dark'];

const SettingsScreen: React.FC = () => {
  const { preference, mode, setPreference, colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.text }]}>Appearance</Text>
      <Text style={[styles.desc, { color: colors.secondaryText }]}>Effective mode: {mode}</Text>
      {PREFS.map(p => (
        <Pressable
          key={p}
          onPress={() => setPreference(p)}
          style={({ pressed }) => [
            styles.option,
            {
              borderColor: colors.border,
              backgroundColor: preference === p ? colors.accent : colors.surface,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={{ color: preference === p ? colors.white : colors.text, fontWeight: preference === p ? '600' : '400' }}>
            {p === 'system' ? 'System default' : p.charAt(0).toUpperCase() + p.slice(1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  heading: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  desc: { fontSize: 14, marginBottom: 16 },
  option: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
});

export default SettingsScreen;
