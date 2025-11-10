import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';

export interface MenuItem {
  id: string;
  label: string;
}

interface MenuButtonProps {
  item: MenuItem;
  active: boolean;
  onPress: () => void;
}

const MenuButton: React.FC<MenuButtonProps> = ({ item, active, onPress }) => {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={active ? { selected: true } : {}}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        active && { backgroundColor: colors.accent },
        pressed && styles.buttonPressed,
      ]}
    >
      <View>
        <Text style={[styles.label, { color: active ? colors.white : colors.text }, active && styles.labelActive]}>{item.label}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: 14,
  },
  labelActive: {
    fontWeight: '600',
  },
});

export default MenuButton;
