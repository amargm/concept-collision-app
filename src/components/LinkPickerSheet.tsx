/**
 * LinkPickerSheet — bottom sheet listing all workspace problems the user can
 * link to. Excludes the current problem and already-linked problems.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {auth, firestore} from '../services/firebase';
import type {Stage} from './StagePicker';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const C = {
  bg:      '#0a0a0a',
  surface: '#111111',
  border:  '#222222',
  text:    '#e8e8e0',
  muted:   '#555550',
  label:   '#888880',
};

const STAGE_COLOR: Record<Stage, string> = {
  waiting:  '#555550',
  thinking: '#c8f064',
  resting:  '#64c8f0',
  clear:    '#c064f0',
  'let go': '#222222',
};

const STAGE_TEXT: Record<Stage, string> = {
  waiting:  '#ffffff',
  thinking: '#0a0a0a',
  resting:  '#0a0a0a',
  clear:    '#ffffff',
  'let go': '#ffffff',
};

const STAGE_LABELS: Record<Stage, string> = {
  waiting:  'WAITING',
  thinking: 'THINKING',
  resting:  'RESTING',
  clear:    'CLEAR',
  'let go': 'LET GO',
};

interface WorkspaceProblem {
  id:    string;
  text:  string;
  stage: Stage;
}

interface Props {
  visible:    boolean;
  excludeIds: string[];
  onClose:    () => void;
  onSelect:   (problemId: string, problemText: string) => void;
}

export default function LinkPickerSheet({visible, excludeIds, onClose, onSelect}: Props) {
  const [problems, setProblems] = useState<WorkspaceProblem[]>([]);
  const [loading,  setLoading]  = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      fetchProblems();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const fetchProblems = async () => {
    const user = auth().currentUser;
    if (!user) {return;}
    setLoading(true);
    try {
      const snap = await firestore()
        .collection('problems')
        .doc(user.uid)
        .collection('items')
        .orderBy('createdAt', 'desc')
        .get();
      const docs: WorkspaceProblem[] = snap.docs
        .filter(d => !excludeIds.includes(d.id) && !d.data().isDeleted)
        .map(d => ({
          id:    d.id,
          text:  d.data().problem ?? '',
          stage: (d.data().stage ?? 'waiting') as Stage,
        }));
      setProblems(docs);
    } catch {
      setProblems([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[s.sheet, {transform: [{translateY: slideAnim}]}]}>
        <View style={s.handle} />
        <Text style={s.title}>LINK TO ANOTHER PROBLEM</Text>
        {loading ? (
          <Text style={s.emptyText}>Loading...</Text>
        ) : problems.length === 0 ? (
          <Text style={s.emptyText}>No other problems available to link.</Text>
        ) : (
          <FlatList
            data={problems}
            keyExtractor={item => item.id}
            style={s.list}
            renderItem={({item}) => {
              const bgColor    = STAGE_COLOR[item.stage] ?? C.muted;
              const textColor  = STAGE_TEXT[item.stage]  ?? '#ffffff';
              const stageLabel = STAGE_LABELS[item.stage] ?? item.stage.toUpperCase();
              return (
                <TouchableOpacity
                  style={s.row}
                  onPress={() => {onSelect(item.id, item.text); onClose();}}
                  activeOpacity={0.7}>
                  <View style={[s.stageChip, {backgroundColor: bgColor}]}>
                    <Text style={[s.stageChipText, {color: textColor}]}>{stageLabel}</Text>
                  </View>
                  <Text style={s.rowText} numberOfLines={1}>{item.text}</Text>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={s.sep} />}
          />
        )}
        <TouchableOpacity style={s.cancelRow} onPress={onClose}>
          <Text style={s.cancelText}>CANCEL</Text>
        </TouchableOpacity>
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
    backgroundColor:  C.surface,
    borderTopWidth:   1,
    borderTopColor:   C.border,
    maxHeight:        SCREEN_HEIGHT * 0.65,
    paddingBottom:    32,
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
    paddingVertical:   14,
    textTransform:     'uppercase',
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingVertical:   14,
    gap:               12,
  },
  sep: {
    height:            1,
    backgroundColor:   C.border,
    marginHorizontal:  24,
  },
  stageChip: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    flexShrink:        0,
  },
  stageChipText: {
    fontFamily:    'monospace',
    fontSize:      8,
    letterSpacing: 1.5,
    fontWeight:    '600',
    textTransform: 'uppercase',
  },
  rowText: {
    flex:          1,
    fontFamily:    'monospace',
    fontSize:      11,
    color:         C.text,
    lineHeight:    17,
  },
  emptyText: {
    fontFamily:        'monospace',
    fontSize:          11,
    color:             C.muted,
    paddingHorizontal: 24,
    paddingVertical:   20,
  },
  cancelRow: {
    alignItems:        'center',
    paddingVertical:   18,
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
});
