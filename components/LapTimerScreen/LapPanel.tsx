import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../ThemeProvider';

interface LapPanelProps {
  title: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  dense?: boolean;
  center?: boolean; // new prop to center content
}

const LapPanel: React.FC<LapPanelProps> = ({ title, children, style, dense, center }) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
        dense && styles.dense,
        center && styles.center,
        style,
      ]}
    >
      <Text style={[styles.title, center && styles.titleCenter, { color: colors.secondaryText }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dense: { padding: 10 },
  center: { alignItems: 'center' },
  title: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 6 },
  titleCenter: { alignSelf: 'center', textAlign: 'center' },
});

export default LapPanel;
