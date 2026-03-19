/**
 * ClosingSheet — appears when user marks a problem CLEAR or LET GO.
 * Captures closing type + optional note, then writes to Firestore.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {auth, firestore} from '../services/firebase';
import type {Stage} from './StagePicker';

// ── Key insight card data passed from the screen ──────────────────────────────
export interface KeyInsightCardData {
  kiKey:       string;   // "collisionId-cardIndex"
  collisionId: string;
  cardIndex:   number;
  domain:      string;
  title:       string;
  accentColor: string;   // index-based accent
  domainColor: string;   // category-based color
}

// ── Closing types ─────────────────────────────────────────────────────────────
type ClosingType = 'landed' | 'still_open' | 'let_it_go' | 'transformed';

interface ClosingOption {
  key:   ClosingType;
  label: string;
  desc:  string;
}

const CLOSING_OPTIONS: ClosingOption[] = [
  {key: 'landed',      label: 'IT LANDED',             desc: 'Insight arrived, I know what to do'},
  {key: 'still_open',  label: 'STILL OPEN',             desc: 'No answer but moving on'},
  {key: 'let_it_go',   label: 'LET IT GO',              desc: 'Stopped mattering'},
  {key: 'transformed', label: 'BECAME SOMETHING ELSE',  desc: 'The question transformed'},
];

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  visible:          boolean;
  targetStage:      Stage;   // 'clear' | 'let go'
  problemId:        string;
  keyInsightCards?: KeyInsightCardData[];
  onClose:          () => void;
  onSaved:          () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ClosingSheet({
  visible,
  targetStage,
  problemId,
  keyInsightCards,
  onClose,
  onSaved,
}: Props) {
  const [selected,        setSelected]        = useState<ClosingType | null>(null);
  const [primaryInsight,  setPrimaryInsight]   = useState<string | null>(null);
  const [note,            setNote]            = useState('');
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [noteFocused,     setNoteFocused]     = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const noteRef   = useRef<TextInput>(null);

  // Reset state on open
  useEffect(() => {
    if (visible) {
      setSelected(null);
      setPrimaryInsight(null);
      setNote('');
      setError(null);
      setSaving(false);
    }
  }, [visible]);

  // Slide animation
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue:    0,
        useNativeDriver: true,
        bounciness: 0,
        speed:      20,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue:    SCREEN_HEIGHT,
        duration:   200,
        useNativeDriver: true,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = async () => {
    if (!selected || saving) {return;}
    const user = auth().currentUser;
    if (!user) {return;}
    setSaving(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const ref = firestore()
        .collection('problems')
        .doc(user.uid)
        .collection('items')
        .doc(problemId);

      // Read current stage for stageHistory
      const snap = await ref.get();
      const prevStage = snap.data()?.stage ?? 'resting';

      const selectedCard = primaryInsight
        ? (keyInsightCards ?? []).find(c => c.kiKey === primaryInsight)
        : undefined;

      await ref.update({
        stage:        targetStage,
        closingType:  selected,
        closingNote:  note.trim(),
        closedAt:     firestore.FieldValue.serverTimestamp(),
        stageHistory: firestore.FieldValue.arrayUnion({
          from: prevStage,
          to:   targetStage,
          at:   new Date().toISOString(),
        }),
        ...(selectedCard && {
          closingPrimaryInsight: {
            collisionId: selectedCard.collisionId,
            cardIndex:   selectedCard.cardIndex,
            domain:      selectedCard.domain,
            title:       selectedCard.title,
          },
        }),
      });

      await ref.collection('events').add({
        type:      'stage_change',
        to:        targetStage,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!selected && !saving;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Scrim */}
      <TouchableOpacity
        style={s.backdrop}
        onPress={onClose}
        activeOpacity={1}
      />

      {/* Sheet */}
      <Animated.View style={[s.sheet, {transform: [{translateY: slideAnim}]}]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Handle */}
            <View style={s.handleWrap}>
              <View style={s.handle} />
            </View>

            {/* Header */}
            <Text style={s.header}>HOW DID THIS END?</Text>

            {/* WHICH INSIGHT MOVED YOU MOST — only when key insights exist */}
            {keyInsightCards && keyInsightCards.length > 0 && (
              <>
                <View style={s.insightSectionRow}>
                  <View style={s.insightLine} />
                  <Text style={s.insightSectionLabel}>WHICH INSIGHT MOVED YOU MOST?</Text>
                  <View style={s.insightLine} />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.insightScroll}
                  contentContainerStyle={s.insightScrollContent}>
                  {keyInsightCards.map(card => {
                    const isSelected = primaryInsight === card.kiKey;
                    const truncTitle = card.title.length > 40
                      ? card.title.slice(0, 40) + '\u2026'
                      : card.title;
                    return (
                      <TouchableOpacity
                        key={card.kiKey}
                        style={[
                          s.insightCard,
                          {borderLeftColor: isSelected ? '#c8f064' : card.accentColor},
                          isSelected && s.insightCardSelected,
                        ]}
                        onPress={() =>
                          setPrimaryInsight(prev =>
                            prev === card.kiKey ? null : card.kiKey,
                          )
                        }
                        activeOpacity={0.75}>
                        <Text style={[s.insightStar, isSelected && s.insightStarSelected]}>
                          {isSelected ? '\u2713' : '\u2605'}
                        </Text>
                        <Text
                          style={[s.insightDomain, {color: card.domainColor}]}
                          numberOfLines={1}>
                          {card.domain.toUpperCase()}
                        </Text>
                        <Text style={s.insightTitle} numberOfLines={2}>
                          {truncTitle}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Closing type options */}
            {CLOSING_OPTIONS.map(opt => {
              const isSelected = selected === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.option, isSelected && s.optionSelected]}
                  onPress={() => setSelected(opt.key)}
                  activeOpacity={0.7}>
                  {/* 2px left bar — accent when selected, border when not */}
                  <View
                    style={[
                      s.optionBar,
                      {backgroundColor: isSelected ? '#c8f064' : '#222222'},
                    ]}
                  />
                  <View style={s.optionContent}>
                    <Text
                      style={[
                        s.optionLabel,
                        {color: isSelected ? '#c8f064' : '#888880'},
                      ]}>
                      {opt.label}
                    </Text>
                    <Text style={s.optionDesc}>{opt.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Final thoughts input */}
            <View style={s.inputSection}>
              <Text
                style={[s.inputLabel, {color: noteFocused ? '#c8f064' : '#888880'}]}>
                ANY FINAL THOUGHTS?
              </Text>
              <TextInput
                ref={noteRef}
                style={[
                  s.input,
                  {borderColor: noteFocused ? '#c8f064' : '#222222'},
                ]}
                value={note}
                onChangeText={setNote}
                placeholder="Optional note..."
                placeholderTextColor="#555550"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                onFocus={() => setNoteFocused(true)}
                onBlur={() => setNoteFocused(false)}
              />
            </View>

            {/* Error */}
            {error && <Text style={s.errorText}>{error}</Text>}

            {/* Save button */}
            <View style={s.saveWrap}>
              <TouchableOpacity
                style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!canSave}
                activeOpacity={0.85}>
                <Text style={s.saveBtnText}>
                  {saving ? 'SAVING...' : 'CLOSE THIS PROBLEM'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{height: 32}} />
          </ScrollView>
        </KeyboardAvoidingView>
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
    maxHeight:       '85%',
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

  // Header
  header: {
    fontFamily:       'serif',
    fontSize:         18,
    color:            '#e8e8e0',
    paddingHorizontal: 24,
    paddingBottom:    20,
  },

  // Closing type row
  option: {
    flexDirection:   'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    minHeight:       56,
    alignItems:      'center',
  },
  optionSelected: {
    backgroundColor: '#161616',
  },
  optionBar: {
    width:      2,
    alignSelf:  'stretch',
    marginRight: 18,
  },
  optionContent: {
    flex:            1,
    paddingVertical: 14,
    paddingRight:    24,
  },
  optionLabel: {
    fontFamily:    'monospace',
    fontSize:      12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  optionDesc: {
    fontFamily: 'monospace',
    fontSize:   10,
    color:      '#555550',
  },

  // Input
  inputSection: {
    paddingHorizontal: 24,
    paddingTop:        20,
    paddingBottom:     8,
  },
  inputLabel: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom:  8,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderWidth:     1,
    fontFamily:      'monospace',
    fontSize:        13,
    color:           '#e8e8e0',
    padding:         12,
    minHeight:       80,
    textAlignVertical: 'top',
  },

  // Error
  errorText: {
    fontFamily:      'monospace',
    fontSize:        10,
    color:           '#f06464',
    paddingHorizontal: 24,
    paddingTop:      6,
  },

  // ── WHICH INSIGHT section ─────────────────────────────────────────────────
  insightSectionRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 24,
    marginTop:         20,
    marginBottom:      12,
  },
  insightLine: {
    flex:            1,
    height:          1,
    backgroundColor: '#222222',
  },
  insightSectionLabel: {
    fontFamily:       'monospace',
    fontSize:         9,
    letterSpacing:    2,
    color:            '#888880',
    textTransform:    'uppercase',
    paddingHorizontal: 10,
  },
  insightScroll: {
    marginBottom: 12,
  },
  insightScrollContent: {
    paddingHorizontal: 24,
    gap:              8,
    paddingVertical:  4,
  },
  insightCard: {
    backgroundColor: '#0a0a0a',
    borderLeftWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width:          140,
  },
  insightCardSelected: {
    backgroundColor: '#0f0f0f',
  },
  insightStar: {
    fontFamily:  'monospace',
    fontSize:    11,
    color:       '#c8f064',
    marginBottom: 3,
  },
  insightStarSelected: {
    color: '#c8f064',
  },
  insightDomain: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1.5,
    marginBottom:  4,
  },
  insightTitle: {
    fontFamily: 'monospace',
    fontSize:   11,
    color:      '#e8e8e0',
    lineHeight: 16,
  },

  // Save button
  saveWrap: {
    paddingHorizontal: 24,
    paddingTop:        16,
  },
  saveBtn: {
    backgroundColor: '#c8f064',
    paddingVertical: 16,
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
