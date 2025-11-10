import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity } from 'react-native';
import TrackListItem from './TrackListScreen/TrackListItem';
import { useTheme } from '../ThemeProvider';

const TRACKS = [
  { id: 'most', name: 'Autodrom Most', location: 'Most, Czech Republic', flag: require('../assets/flags/cz.png') },
  { id: 'brno', name: 'Brno Circuit', location: 'Brno, Czech Republic', flag: require('../assets/flags/cz.png') },
  { id: 'slovakia', name: 'Slovakia Ring', location: 'Orechová Potôň, Slovakia', flag: require('../assets/flags/sk.png') },
  { id: 'mugello', name: 'Mugello Circuit', location: 'Scarperia e San Piero, Italy', flag: require('../assets/flags/it.png') },
  { id: 'barcelona', name: 'Circuit de Barcelona-Catalunya', location: 'Montmeló, Spain', flag: require('../assets/flags/es.png') },
];

const TrackListScreen = () => {
  const [search, setSearch] = useState('');
  const { colors } = useTheme();
  const filteredTracks = TRACKS.filter(track =>
    track.name.toLowerCase().includes(search.toLowerCase()) ||
    track.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>Select a Track</Text>
      <TextInput
        style={[styles.search, { backgroundColor: colors.surface, color: colors.inputText, borderColor: colors.border }]}
        placeholder="Search by name or country"
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={colors.placeholder}
      />
      <FlatList
        data={filteredTracks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TrackListItem item={item} />}
        contentContainerStyle={{ paddingBottom: 80 }}
      />
      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.fabShadow }]}>
        <Text style={[styles.fabText, { color: colors.white }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0, paddingTop: 32, width: '100%' },
  header: { fontSize: 24, fontWeight: '700', alignSelf: 'center', marginBottom: 24 },
  search: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 18, marginHorizontal: 0, marginBottom: 20, borderWidth: 1 },
  fab: { position: 'absolute', right: 24, bottom: 32, width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  fabText: { fontSize: 36, fontWeight: '700', marginTop: -2 },
});

export default TrackListScreen;
