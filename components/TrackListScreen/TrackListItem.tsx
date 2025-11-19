import React from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from '../../ThemeProvider';
import {Track} from '../../data/tracks';

interface TrackListItemProps {
    track: Track;
    onPress?: (track: Track) => void
}

const TrackListItem: React.FC<TrackListItemProps> = ({track, onPress}) => {
    const {colors} = useTheme();

    if (!track) {
        return null;
    }

    return (
        <TouchableOpacity activeOpacity={0.85} onPress={() => onPress?.(track)}
                          style={[styles.trackItem, {backgroundColor: colors.surface}]}>
            <Image source={track.flag} style={styles.flag}/>
            <View style={styles.trackInfo}>
                <Text style={[styles.trackName, {color: colors.text}]}>{track.name}</Text>
                <Text style={[styles.trackLocation, {color: colors.secondaryText}]}>{track.location}</Text>
            </View>
            <TouchableOpacity style={[styles.startButton, {backgroundColor: colors.primary}]}>
                <Text style={[styles.startButtonText, {color: colors.white}]}>🏁 Start</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    trackItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 0,
        marginBottom: 8,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        borderRadius: 12
    },
    flag: {width: 48, height: 48, borderRadius: 24, marginRight: 16},
    trackInfo: {flex: 1},
    trackName: {fontSize: 18, fontWeight: '700'},
    trackLocation: {fontSize: 15},
    startButton: {
        paddingVertical: 8,
        paddingHorizontal: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20
    },
    startButtonText: {fontSize: 16},
});

export default TrackListItem;
