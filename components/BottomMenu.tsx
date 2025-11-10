import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MenuButton, { MenuItem } from './MenuButton';
import { useTheme } from '../ThemeProvider';

export interface BottomMenuProps {
  items: MenuItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const BottomMenu: React.FC<BottomMenuProps> = ({ items, selectedId, onSelect }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8), borderTopColor: colors.border, backgroundColor: colors.surface }] }>
      {items.map(item => (
        <MenuButton
          key={item.id}
          item={item}
          active={item.id === selectedId}
          onPress={() => onSelect(item.id)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
});

export default BottomMenu;
