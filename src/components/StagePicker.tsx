/**
 * StagePicker — bottom sheet for moving a problem through stages.
 * Two views: 'picker' (all 5 stages) and 'howEnd' (CLEAR + LET GO only).
 * Selecting CLEAR or LET GO from the picker view transitions to howEnd.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Stage types (exported so parent can import) ───────────────────────────────
export type Stage = 'waiting' | 'thinking' | 'resting' | 'clear' | 'let go';

const STAGE_COLOR: Record<Stage, string> = {
  waiting:  '#555550',
  thinking: '#c8f064',
  resting:  '#64c8f0',
  clear:    '#c064f0',
  'let go': '#222222',
};

export const STAGE_LABELS: Record<Stage, string> = {
  waiting:  'WAITING',
  thinking: 'THINKING',
  resting:  'RESTING',
  clear:    'CLEAR',
  'let go': 'LET GO',
};

const STAGE_DESC: Record<Stage, string> = {
  waiting:  'Not started yet',
  thinking: 'Actively exploring',
  resting:  'Sitting with it',
  clear:    'Thinking cleared',
  'let go': 'No longer relevant',
};

const ALL_STAGES:     Stage[] = ['waiting', 'thinking', 'resting', 'clear', 'let go'];
const CLOSING_STAGES: Stage[] = ['clear', 'let go'];

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  visible:        boolean;
  currentStage:   Stage;
  onClose:        () => void;
  onStageChange:  (stage: Stage) => Promise<void>;
  startOnHowEnd?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function StagePicker({
  visible,
  currentStage,
  onClose,
  onStageChange,
  startOnHowEnd = false,
}: Props) {
  const [view,   setView]   = useState<'picker' | 'howEnd'>(startOnHowEnd ? 'howEnd' : 'picker');
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Reset view whenever the sheet opens
  useEffect(() => {
    if (visible) {
      setView(startOnHowEnd ? 'howEnd' : 'picker');
      setSaving(false);
    }
  }, [visible, startOnHowEnd]);

  // Slide animation
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue:    0,
        useNativeDriver: true,
        bounciness: 0,
        speed:      22,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue:    SCREEN_HEIGHT,
        duration:   220,
        useNativeDriver: true,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSelect = async (stage: Stage) => {
    // In picker view, CLEAR / LET GO → transition to howEnd instead of committing
    if (view === 'picker' && (stage === 'clear' || stage === 'let go')) {
      setView('howEnd');
      return;
    }
    if (saving) {return;}
    setSaving(true);
    try {
      await onStageChange(stage);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const stages = view === 'howEnd' ? CLOSING_STAGES : ALL_STAGES;
  const title  = view === 'howEnd' ? 'HOW DID THIS END?' : 'MOVE TO';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Scrim — tap to dismiss */}
      <TouchableOpacity
        style={s.backdrop}
        onPress={onClose}
        activeOpacity={1}
      />

      {/* Bottom sheet panel */}
      <Animated.View style={[s.sheet, {transform: [{translateY: slideAnim}]}]}>

        {/* Handle bar */}
        <View style={s.handleWrap}>
          <View style={s.handle} />
        </View>

        {/* Back arrow — only shown on howEnd view when it wasn't opened directly */}
        {view === 'howEnd' && !startOnHowEnd && (
          <TouchableOpacity style={s.backRow} onPress={() => setView('picker')}>
            <Text style={s.backText}>← BACK</Text>
          </TouchableOpacity>
        )}

        {/* Title */}
        <Text style={s.sheetTitle}>{title}</Text>

        {/* Stage rows */}
        {stages.map(stage => {
          const color      = STAGE_COLOR[stage];
          const isCurrent  = stage === currentStage;
          return (
            <TouchableOpacity
              key={stage}
              style={[s.row, isCurrent && s.rowActive]}
              onPress={() => handleSelect(stage)}
              disabled={saving}
              activeOpacity={0.7}>
              {/* 3px left accent bar */}
              <View style={[s.rowBar, {backgroundColor: color}]} />
              {/* Stage name */}
              <Text style={[s.rowLabel, {color}]}>
                {STAGE_LABELS[stage]}
              </Text>
              {/* Description */}
              <Text style={s.rowDesc}>{STAGE_DESC[stage]}</Text>
              {/* Current indicator */}
              {isCurrent && <View style={[s.currentDot, {backgroundColor: color}]} />}
            </TouchableOpacity>
          );
        })}

        {/* Safe-area bottom padding */}
        <View style={{height: 28}} />
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: '#111111',
    borderTopWidth:  1,
    borderTopColor:  '#222222',
  },

  // Handle bar
  handleWrap: {
    alignItems:    'center',
    paddingTop:    12,
    paddingBottom: 6,
  },
  handle: {
    width:           32,
    height:          3,
    backgroundColor: '#333333',
  },

  // Back nav (howEnd only)
  backRow: {
    paddingHorizontal: 24,
    paddingVertical:   8,
  },
  backText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         '#888880',
  },

  // Sheet title
  sheetTitle: {
    fontFamily:      'monospace',
    fontSize:        9,
    letterSpacing:   3,
    color:           '#888880',
    textTransform:   'uppercase',
    paddingHorizontal: 24,
    paddingTop:      6,
    paddingBottom:   10,
  },

  // Stage row
  row: {
    height:          52,
    flexDirection:   'row',
    alignItems:      'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    paddingRight:    24,
  },
  rowActive: {
    backgroundColor: '#161616',
  },
  rowBar: {
    width:       3,
    alignSelf:   'stretch',
    marginRight: 18,
  },
  rowLabel: {
    fontFamily:    'monospace',
    fontSize:      12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    flex:          1,
  },
  rowDesc: {
    fontFamily: 'monospace',
    fontSize:   10,
    color:      '#555550',
    marginRight: 10,
  },
  currentDot: {
    width:  6,
    height: 6,
  },
});
