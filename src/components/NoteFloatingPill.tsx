/**
 * NoteFloatingPill — NOTE label in the fixed action bar.
 * Tapping it opens NoteSheet.
 */
import React from 'react';
import {StyleSheet, Text, TouchableOpacity} from 'react-native';

interface Props {
  onPress: () => void;
}

export default function NoteFloatingPill({onPress}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
      activeOpacity={0.7}>
      <Text style={s.label}>NOTE</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  label: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         '#888880',
    textTransform: 'uppercase',
  },
});
