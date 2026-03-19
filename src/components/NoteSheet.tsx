/**
 * NoteSheet — compact non-modal bottom sheet for capturing thread notes.
 * Slides up from just above the fixed action bar (bottom: ACTION_BAR_H).
 * Keyboard avoidance handled via Keyboard listeners (shifts bottom offset).
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Keyboard,
  KeyboardEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Height of the fixed action bar in ProblemDetailScreen
const ACTION_BAR_H = 60;

interface Props {
  visible:  boolean;
  onClose:  () => void;
  /** Called with trimmed note text. Should reject on error. */
  onSave:   (text: string) => Promise<void>;
}

export default function NoteSheet({visible, onClose, onSave}: Props) {
  const [text,     setText]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const inputRef  = useRef<TextInput>(null);

  // ── Keyboard height tracking ──────────────────────────────────────────────
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => setKbHeight(e.endCoordinates.height);
    const onHide = () => setKbHeight(0);

    const s1 = Keyboard.addListener(showEvent, onShow);
    const s2 = Keyboard.addListener(hideEvent, onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  // ── Slide in / out ────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setText('');
      setSaving(false);
      Animated.spring(slideAnim, {
        toValue:         0,
        bounciness:      0,
        speed:           20,
        useNativeDriver: true,
      }).start(() => {
        // Fallback focus in case autoFocus doesn't fire after animation
        inputRef.current?.focus();
      });
    } else {
      Keyboard.dismiss();
      Animated.timing(slideAnim, {
        toValue:         300,
        duration:        180,
        useNativeDriver: true,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = async () => {
    if (!text.trim() || saving) {return;}
    setSaving(true);
    try {
      await onSave(text.trim());
      onClose();
    } catch {
      setSaving(false);
    }
  };

  if (!visible) {return null;}

  return (
    // Positioned absolutely above the action bar, shifts up with keyboard
    <Animated.View
      style={[
        s.sheet,
        {
          bottom:    ACTION_BAR_H + kbHeight,
          transform: [{translateY: slideAnim}],
        },
      ]}>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        scrollEnabled={false}>

        {/* Handle */}
        <View style={s.handleWrap}>
          <View style={s.handle} />
        </View>

        {/* Text input */}
        <TextInput
          ref={inputRef}
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="What are you thinking?"
          placeholderTextColor="#555550"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          autoFocus
        />

        {/* SAVE NOTE button */}
        <View style={s.btnWrap}>
          <TouchableOpacity
            style={[s.saveBtn, (!text.trim() || saving) && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!text.trim() || saving}
            activeOpacity={0.85}>
            <Text style={s.saveBtnText}>
              {saving ? 'SAVING...' : 'SAVE NOTE'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{height: 8}} />
      </ScrollView>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  sheet: {
    position:        'absolute',
    left:            0,
    right:           0,
    backgroundColor: '#111111',
    borderTopWidth:  1,
    borderTopColor:  '#222222',
    zIndex:          100,
    elevation:       8,
  },

  // Handle
  handleWrap: {
    alignItems:    'center',
    paddingTop:    12,
    paddingBottom: 8,
  },
  handle: {
    width:           32,
    height:          3,
    backgroundColor: '#333333',
  },

  // Input
  input: {
    backgroundColor: '#0a0a0a',
    borderWidth:     1,
    borderColor:     '#222222',
    fontFamily:      'monospace',
    fontSize:        13,
    color:           '#e8e8e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 24,
    minHeight:       120,
    textAlignVertical: 'top',
  },

  // Button row
  btnWrap: {
    paddingHorizontal: 24,
    paddingTop:        12,
  },
  saveBtn: {
    backgroundColor: '#c8f064',
    paddingVertical: 14,
    alignItems:      'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#2a2a20',
  },
  saveBtnText: {
    fontFamily:    'monospace',
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 3,
    color:         '#0a0a0a',
    textTransform: 'uppercase',
  },
});
