/**
 * LinkTypeSheet — appears after selecting a problem to link to.
 * User picks one of four relationship types, then confirms.
 */
import React, {useRef, useEffect, useState} from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const C = {
  bg:      '#0a0a0a',
  surface: '#111111',
  card:    '#141414',
  border:  '#222222',
  text:    '#e8e8e0',
  muted:   '#555550',
  label:   '#888880',
  accent:  '#c8f064',
};

export type LinkType = 'related' | 'blocking' | 'sub_problem' | 'spawned_from';

interface LinkOption {
  key:   LinkType;
  label: string;
  desc:  string;
}

const LINK_OPTIONS: LinkOption[] = [
  {key: 'related',      label: 'RELATED',        desc: 'These share structural overlap'},
  {key: 'blocking',     label: 'BLOCKING',        desc: 'I cannot move forward without resolving that one'},
  {key: 'sub_problem',  label: 'SUB-PROBLEM',     desc: 'This is a part of the selected problem'},
  {key: 'spawned_from', label: 'SPAWNED FROM',    desc: 'This question came from exploring that one'},
];

interface Props {
  visible:    boolean;
  targetText: string;
  onClose:    () => void;
  onConfirm:  (linkType: LinkType) => void;
}

export default function LinkTypeSheet({visible, targetText, onClose, onConfirm}: Props) {
  const [selected, setSelected] = useState<LinkType | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setSelected(null);
      Animated.spring(slideAnim, {
        toValue:         0,
        useNativeDriver: true,
        bounciness:      0,
        speed:           20,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue:         SCREEN_HEIGHT,
        duration:        250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleConfirm = () => {
    if (!selected) {return;}
    onConfirm(selected);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[s.sheet, {transform: [{translateY: slideAnim}]}]}>
        <View style={s.handle} />

        <Text style={s.title}>HOW ARE THESE CONNECTED?</Text>

        {!!targetText && (
          <Text style={s.targetText} numberOfLines={2}>{targetText}</Text>
        )}

        <View style={s.optionsWrap}>
          {LINK_OPTIONS.map(opt => {
            const active = selected === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[s.option, active && s.optionActive]}
                onPress={() => setSelected(opt.key)}
                activeOpacity={0.75}>
                <Text style={[s.optionLabel, active && s.optionLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={s.optionDesc}>{opt.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.actions}>
          <TouchableOpacity onPress={onClose}>
            <Text style={s.cancelText}>CANCEL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.confirmBtn, !selected && s.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!selected}>
            <Text style={[s.confirmText, !selected && s.confirmTextDisabled]}>
              LINK
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopWidth:  1,
    borderTopColor:  C.border,
    paddingBottom:   32,
  },
  handle: {
    width:           40,
    height:          3,
    backgroundColor: C.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginTop:       10,
    marginBottom:    6,
  },
  title: {
    fontFamily:        'monospace',
    fontSize:          9,
    letterSpacing:     3,
    color:             C.label,
    paddingHorizontal: 24,
    paddingTop:        14,
    paddingBottom:     6,
    textTransform:     'uppercase',
  },
  targetText: {
    fontFamily:        'monospace',
    fontSize:          11,
    color:             C.muted,
    paddingHorizontal: 24,
    paddingBottom:     14,
    lineHeight:        17,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom:      4,
  },
  optionsWrap: {
    paddingTop: 4,
  },
  option: {
    paddingHorizontal: 24,
    paddingVertical:   14,
    borderLeftWidth:   2,
    borderLeftColor:   'transparent',
    marginBottom:      1,
  },
  optionActive: {
    borderLeftColor:   C.accent,
    backgroundColor:   C.card,
  },
  optionLabel: {
    fontFamily:    'monospace',
    fontSize:      11,
    letterSpacing: 2,
    color:         C.muted,
    marginBottom:  4,
    textTransform: 'uppercase',
  },
  optionLabelActive: {
    color: C.accent,
  },
  optionDesc: {
    fontFamily: 'monospace',
    fontSize:   10,
    color:      C.muted,
    lineHeight: 15,
  },
  actions: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingTop:        20,
    borderTopWidth:    1,
    borderTopColor:    C.border,
    marginTop:         8,
  },
  cancelText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         C.muted,
    textTransform: 'uppercase',
  },
  confirmBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 24,
    paddingVertical:   12,
  },
  confirmBtnDisabled: {
    opacity: 0.35,
  },
  confirmText: {
    fontFamily:    'monospace',
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 3,
    color:         '#0a0a0a',
    textTransform: 'uppercase',
  },
  confirmTextDisabled: {
    color: '#0a0a0a',
  },
});
