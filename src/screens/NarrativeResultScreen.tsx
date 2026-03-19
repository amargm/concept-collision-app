/**
 * NarrativeResultScreen — displays narrative/story mode collision results.
 * Pro-only: free users are redirected to Paywall on mount.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {auth, firestore} from '../services/firebase';
import {COLORS, CARD_COLORS} from '../utils/constants';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../App';
import type {NarrativeResult, NarrativeItem} from '../hooks/useCollision';

type Props = NativeStackScreenProps<RootStackParamList, 'NarrativeResult'>;

// ── Loading dots ──────────────────────────────────────────────────────────────
function LoadingDots() {
  const dots = [
    useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.4)).current,
  ];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, {toValue: 1, duration: 350, useNativeDriver: true}),
          Animated.timing(d, {toValue: 0.4, duration: 350, useNativeDriver: true}),
          Animated.delay((2 - i) * 180),
        ]),
      ),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={cs.loadingRow}>
      <View style={cs.loadingDots}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[cs.dot, {opacity: d}]} />
        ))}
      </View>
      <Text style={cs.loadingText}>CHECKING ACCESS...</Text>
    </View>
  );
}

// ── Single narrative card ─────────────────────────────────────────────────────
function NarrativeCard({
  item,
  index,
}: {
  item: NarrativeItem;
  index: number;
}) {
  const accentColor = CARD_COLORS[index] ?? COLORS.accent;
  const num = String(index + 1);

  return (
    <View style={cs.narrativeWrap}>
      {/* Decorative number */}
      <Text style={cs.decorativeNum}>{num}</Text>

      {/* Card */}
      <View style={cs.card}>
        {/* 2px accent top bar */}
        <View style={[cs.cardBar, {backgroundColor: accentColor}]} />

        <View style={cs.cardContent}>
          {/* Setting */}
          <Text style={cs.setting}>{item.setting}</Text>

          {/* Domain */}
          <Text style={cs.domain}>{item.domain}</Text>

          {/* Story prose */}
          <Text style={cs.story}>{item.story}</Text>

          {/* Divider */}
          <View style={cs.divider} />

          {/* WHAT THIS MEANS */}
          <Text style={cs.bridgeLabel}>WHAT THIS MEANS</Text>
          <Text style={cs.bridge}>{item.bridge}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function NarrativeResultScreen({navigation, route}: Props) {
  const {problem, result, collisionId} = route.params;
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | null>(null);

  // Pro gate
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {return;}
    firestore()
      .collection('users')
      .doc(user.uid)
      .get()
      .then(snap => {
        const plan = snap.data()?.plan ?? 'free';
        if (plan !== 'pro') {
          navigation.replace('Paywall');
        } else {
          setUserPlan('pro');
        }
      })
      .catch(() => {
        // On error default to showing content — don't punish network issues
        setUserPlan('pro');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShare = async () => {
    const narrativeLines = (result.narratives ?? []).flatMap((n, i) => [
      ``,
      `${i + 1}. ${n.domain.toUpperCase()} — ${n.setting}`,
      n.story,
      `↳ ${n.bridge}`,
    ]);
    await Share.share({
      message: [
        `PROBLEM: ${problem}`,
        ``,
        `STRUCTURAL ESSENCE: ${result.structural_essence}`,
        ...narrativeLines,
        ``,
        `SYNTHESIS: ${result.synthesis}`,
      ].join('\n'),
    });
  };

  // While plan is being checked show loading
  if (userPlan === null) {
    return (
      <SafeAreaView style={cs.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={cs.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={cs.backText}>← BACK</Text>
          </TouchableOpacity>
        </View>
        <LoadingDots />
      </SafeAreaView>
    );
  }

  const narratives: NarrativeItem[] = result.narratives ?? [];

  return (
    <SafeAreaView style={cs.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* ── Top bar ── */}
      <View style={cs.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={cs.backText}>← BACK</Text>
        </TouchableOpacity>
        <View style={cs.topBarRight}>
          <View style={cs.proTag}>
            <Text style={cs.proTagText}>PRO</Text>
          </View>
          <TouchableOpacity onPress={handleShare}>
            <Text style={cs.shareText}>SHARE ↗</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={cs.scroll}
        contentContainerStyle={cs.scrollContent}
        keyboardShouldPersistTaps="handled">

        {/* Structural essence */}
        <View style={cs.essenceBlock}>
          <Text style={cs.sectionLabel}>STRUCTURAL ESSENCE</Text>
          <Text style={cs.essenceText}>{result.structural_essence}</Text>
        </View>

        {/* Narrative thread label */}
        <Text style={[cs.sectionLabel, {marginTop: 28, marginBottom: 4}]}>
          STORIES
        </Text>

        {/* Narrative cards */}
        {narratives.map((item, i) => (
          <NarrativeCard key={item.domain + i} item={item} index={i} />
        ))}

        {/* Synthesis */}
        <Text style={[cs.sectionLabel, {marginTop: 28, marginBottom: 14}]}>
          SYNTHESIS
        </Text>
        <View style={cs.synthesisCard}>
          <Text style={cs.synthesisText}>{result.synthesis}</Text>
        </View>

        {/* New collision */}
        <TouchableOpacity
          style={cs.newBtn}
          onPress={() => navigation.popToTop()}>
          <Text style={cs.newBtnText}>NEW COLLISION →</Text>
        </TouchableOpacity>

        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const cs = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},

  // Top bar
  topBar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
  },
  backText: {
    fontFamily:    'monospace',
    fontSize:      11,
    letterSpacing: 2,
    color:         COLORS.mutedLight,
  },
  shareText: {
    fontFamily:    'monospace',
    fontSize:      11,
    letterSpacing: 2,
    color:         COLORS.accent,
  },
  proTag: {
    borderWidth:       1,
    borderColor:       COLORS.accent,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  proTagText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         COLORS.accent,
    fontWeight:    '600',
  },

  // Loading
  loadingRow:  {alignItems: 'center', paddingVertical: 40},
  loadingDots: {flexDirection: 'row', gap: 8, marginBottom: 12},
  dot:         {width: 8, height: 8, backgroundColor: COLORS.accent},
  loadingText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 3,
    color:         COLORS.accent,
  },

  // Scroll
  scroll:        {flex: 1},
  scrollContent: {paddingHorizontal: 20, paddingBottom: 60},

  // Structural essence block
  essenceBlock: {
    borderLeftWidth:  3,
    borderLeftColor:  COLORS.accent,
    paddingLeft:      14,
    paddingVertical:  16,
    marginTop:        20,
  },
  sectionLabel: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 3,
    color:         COLORS.muted,
    textTransform: 'uppercase',
  },
  essenceText: {
    fontFamily:  'serif',
    fontSize:    16,
    fontStyle:   'italic',
    color:       COLORS.text,
    lineHeight:  24,
    marginTop:   8,
  },

  // Narrative card wrapper (number + card)
  narrativeWrap: {
    marginTop: 20,
  },
  decorativeNum: {
    fontFamily:  'serif',
    fontSize:    48,
    fontWeight:  '700',
    color:       '#1a1a1a',
    lineHeight:  48,
    marginBottom: -8,
    paddingLeft: 4,
  },

  // Card
  card: {
    borderWidth:     1,
    borderColor:     COLORS.border,
    backgroundColor: COLORS.card,
    overflow:        'hidden',
  },
  cardBar: {
    height: 2,
    width:  '100%',
  },
  cardContent: {
    padding: 16,
  },

  // Setting
  setting: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 3,
    color:         '#888880',
    textTransform: 'uppercase',
    marginBottom:  8,
  },

  // Domain
  domain: {
    fontFamily:   'serif',
    fontSize:     20,
    fontStyle:    'italic',
    color:        COLORS.text,
    marginBottom: 12,
  },

  // Story prose
  story: {
    fontFamily:   'serif',
    fontSize:     14,
    lineHeight:   26,
    color:        COLORS.mutedLight,
    marginBottom: 16,
  },

  // Divider
  divider: {
    height:        1,
    backgroundColor: '#222222',
    marginBottom:  14,
  },

  // Bridge
  bridgeLabel: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 3,
    color:         COLORS.accent,
    textTransform: 'uppercase',
    marginBottom:  8,
  },
  bridge: {
    fontFamily: 'monospace',
    fontSize:   11,
    color:      '#555550',
    lineHeight: 18,
  },

  // Synthesis
  synthesisCard: {
    borderWidth:     1,
    borderColor:     COLORS.border,
    backgroundColor: COLORS.card,
    padding:         16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    marginBottom:    20,
  },
  synthesisText: {
    fontFamily: 'serif',
    fontSize:   15,
    color:      COLORS.text,
    lineHeight: 24,
  },

  // New collision button
  newBtn: {
    borderWidth:     1,
    borderColor:     COLORS.accent,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       8,
  },
  newBtnText: {
    fontFamily:    'monospace',
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 3,
    color:         COLORS.accent,
  },
});
