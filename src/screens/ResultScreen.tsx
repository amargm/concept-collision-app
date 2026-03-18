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
import {BACKEND_URL, CARD_COLORS, COLORS} from '../utils/constants';
import {auth, firestore} from '../services/firebase';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../App';
import type {Collision, CollisionResult} from '../hooks/useCollision';
import {ShareCollisionCard, ShareSynthesisCard} from '../components/ShareCard';
import {shareCardImage} from '../utils/shareCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

const MAX_DEPTH = 3;

// ── Animated entry wrapper ────────────────────────────────────────────────────
function AnimatedEntry({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 280, delay, useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 280, delay, useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={{opacity, transform: [{translateY}]}}>
      {children}
    </Animated.View>
  );
}

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
      <Text style={cs.loadingText}>SCANNING DOMAINS...</Text>
    </View>
  );
}

// ── Recursive collision card ──────────────────────────────────────────────────
interface CardProps {
  collision: Collision;
  accentColor: string;
  depth: number;
  breadcrumb: string[];
  problem: string;
  structuralEssence: string;
  userPlan: 'free' | 'pro' | null;
  onPaywall: () => void;
  shareRef?: React.RefObject<View>;
}

function CollisionCard({
  collision,
  accentColor,
  depth,
  breadcrumb,
  problem,
  structuralEssence,
  userPlan,
  onPaywall,
  shareRef,
}: CardProps) {
  const [chainItems, setChainItems] = useState<Collision[]>([]);
  const [loading, setLoading] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleGoDeeper = async () => {
    if (userPlan === 'free' || userPlan === null) {
      onPaywall();
      return;
    }
    if (loading || chainItems.length > 0) {return;}
    setLoading(true);
    setChainError(null);
    try {
      const user = auth().currentUser;
      if (!user) {throw new Error('Not signed in');}
      const token = await user.getIdToken();
      const resp = await fetch(`${BACKEND_URL}/collide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          problem,
          mode: 'deeper',
          domain: collision.domain,
          structuralEssence,
        }),
      });
      if (!resp.ok) {
        const b = await resp.json().catch(() => ({}));
        const errCode = b?.error ?? '';
        throw new Error(
          errCode === 'pro_required'
            ? 'Pro plan required'
            : errCode || `Error ${resp.status}`,
        );
      }
      const b = await resp.json();
      const data = b.result ?? b;
      if (!Array.isArray(data.collisions)) {throw new Error('Unexpected response');}
      setChainItems(data.collisions.slice(0, 3));
    } catch (e: any) {
      setChainError(e?.message ?? 'Chain call failed');
    } finally {
      setLoading(false);
    }
  };

  const childBreadcrumb = [...breadcrumb, collision.domain];
  const isChained = depth > 0;

  return (
    <View>
      <View
        style={[
          cs.card,
          isChained && {
            marginLeft: depth * 16,
            borderLeftWidth: 2,
            borderLeftColor: accentColor,
          },
        ]}>
        {/* 2px accent top bar */}
        <View style={[cs.cardBar, {backgroundColor: accentColor}]} />
        <View style={cs.cardContent}>
          {/* Breadcrumb — only on chain cards */}
          {isChained && breadcrumb.length > 0 && (
            <Text style={cs.breadcrumb} numberOfLines={1}>
              {breadcrumb.join(' > ')}
            </Text>
          )}

          {/* Domain row */}
          <View style={cs.domainRow}>
            <View style={[cs.domainDot, {backgroundColor: accentColor}]} />
            <Text style={cs.domainName}>
              {collision.domain.toUpperCase()}
            </Text>
          </View>

          <Text style={cs.cardTitle}>{collision.title}</Text>
          <Text style={cs.cardBody}>{collision.how_they_solved_it}</Text>
          <View style={cs.divider} />
          <Text style={[cs.bridgeLabel, {color: accentColor}]}>
            STRUCTURAL BRIDGE
          </Text>
          <Text style={cs.bridgeText}>{collision.bridge}</Text>

          {/* Share card button — depth 0 only */}
          {depth === 0 && shareRef && (
            <>
              <View style={cs.divider} />
              <TouchableOpacity
                style={cs.shareCardBtn}
                onPress={async () => {
                  setShareError(null);
                  try {
                    await shareCardImage(shareRef);
                  } catch (e: any) {
                    setShareError(e?.message ?? 'Share failed');
                  }
                }}>
                <Text style={[cs.shareCardText, {color: accentColor}]}>
                  SHARE CARD ↗
                </Text>
              </TouchableOpacity>
              {shareError !== null && (
                <Text style={cs.errorText}>{shareError}</Text>
              )}
            </>
          )}

          {/* Go Deeper */}
          {depth < MAX_DEPTH && (
            <>
              <View style={cs.divider} />
              {loading ? (
                <LoadingDots />
              ) : chainItems.length === 0 ? (
                <TouchableOpacity
                  onPress={handleGoDeeper}
                  style={cs.deeperBtn}>
                  <Text style={[cs.deeperText, {color: accentColor}]}>
                    {`GO DEEPER IN ${collision.domain.toUpperCase()} \u2192`}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {chainError !== null && (
                <Text style={cs.errorText}>{chainError}</Text>
              )}
            </>
          )}
        </View>
      </View>

      {/* Recursive chain children */}
      {chainItems.map((chain, i) => (
        <AnimatedEntry key={`${collision.domain}-${depth}-${i}`} delay={i * 90}>
          <CollisionCard
            collision={chain}
            accentColor={accentColor}
            depth={depth + 1}
            breadcrumb={childBreadcrumb}
            problem={problem}
            structuralEssence={structuralEssence}
            userPlan={userPlan}
            onPaywall={onPaywall}
          />
        </AnimatedEntry>
      ))}
    </View>
  );
}

// ── Result screen ─────────────────────────────────────────────────────────────
export default function ResultScreen({navigation, route}: Props) {
  const {problem, result, collisionId} = route.params;
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | null>(null);
  const [synthShareError, setSynthShareError] = useState<string | null>(null);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [workspaceSavedOpacity] = useState(() => new Animated.Value(0));

  const handleSaveProblemToWorkspace = async () => {
    if (savingWorkspace) return;
    const user = auth().currentUser;
    if (!user) return;
    setSavingWorkspace(true);
    try {
      await firestore()
        .collection('problems')
        .doc(user.uid)
        .collection('items')
        .add({
          problem: problem.trim(),
          stage: 'resting',
          source: 'elevated',
          collisionCount: 1,
          collisionIds: collisionId ? [collisionId] : [],
          domains: result.collisions.map(c => c.domain),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      Animated.sequence([
        Animated.timing(workspaceSavedOpacity, {toValue: 1, duration: 200, useNativeDriver: true}),
        Animated.delay(1800),
        Animated.timing(workspaceSavedOpacity, {toValue: 0, duration: 300, useNativeDriver: true}),
      ]).start();
    } catch {
      // silently ignore
    } finally {
      setSavingWorkspace(false);
    }
  };

  // One share ref per top-level collision card + one for synthesis
  const cardRefs = useRef<React.RefObject<View>[]>(
    result.collisions.map(() => React.createRef<View>()),
  ).current;
  const synthesisRef = useRef<View>(null);

  // Read plan once on mount
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {return;}
    firestore()
      .collection('users')
      .doc(user.uid)
      .get()
      .then(snap => {
        const data = snap.data() ?? {};
        setUserPlan(data.plan === 'pro' ? 'pro' : 'free');
      })
      .catch(() => setUserPlan('free'));
  }, []);

  const handleShare = async () => {
    await Share.share({
      message: [
        `PROBLEM: ${problem}`,
        '',
        `STRUCTURAL ESSENCE: ${result.structural_essence}`,
        '',
        `SYNTHESIS: ${result.synthesis}`,
      ].join('\n'),
    });
  };

  const handlePaywall = () => {
    navigation.navigate('Paywall');
  };

  return (
    <SafeAreaView style={cs.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Hidden ShareCards — rendered off-screen for captureRef */}
      <View style={cs.offScreen}>
        {result.collisions.map((collision, i) => (
          <View key={i} ref={cardRefs[i]} collapsable={false}>
            <ShareCollisionCard
              domain={collision.domain}
              title={collision.title}
              story={collision.how_they_solved_it}
              bridge={collision.bridge}
              structuralEssence={result.structural_essence}
              accentColor={CARD_COLORS[i] ?? COLORS.accent}
            />
          </View>
        ))}
        <View ref={synthesisRef} collapsable={false}>
          <ShareSynthesisCard
            structuralEssence={result.structural_essence}
            synthesis={result.synthesis}
          />
        </View>
      </View>

      {/* Top bar */}
      <View style={cs.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={cs.backText}>← BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare}>
          <Text style={cs.shareText}>SHARE ↗</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={cs.scroll}
        contentContainerStyle={cs.scrollContent}
        keyboardShouldPersistTaps="handled">

        {/* Structural Essence */}
        <View style={cs.essenceBlock}>
          <Text style={cs.sectionLabel}>STRUCTURAL ESSENCE</Text>
          <Text style={cs.essenceText}>{result.structural_essence}</Text>
        </View>

        {/* Domain Collisions */}
        <Text style={[cs.sectionLabel, {marginTop: 28, marginBottom: 14}]}>
          DOMAIN COLLISIONS
        </Text>
        {result.collisions.map((collision, i) => (
          <CollisionCard
            key={i}
            collision={collision}
            accentColor={CARD_COLORS[i] ?? COLORS.accent}
            depth={0}
            breadcrumb={[]}
            problem={problem}
            structuralEssence={result.structural_essence}
            userPlan={userPlan}
            onPaywall={handlePaywall}
            shareRef={cardRefs[i]}
          />
        ))}

        {/* Synthesis */}
        <Text style={[cs.sectionLabel, {marginTop: 28, marginBottom: 14}]}>
          SYNTHESIS
        </Text>
        <View style={cs.synthesisCard}>
          <Text style={cs.synthesisTag}>SYNTHESIS</Text>
          <Text style={cs.synthesisText}>{result.synthesis}</Text>
        </View>

        {/* Share Synthesis */}
        <TouchableOpacity
          style={cs.shareSynthesisBtn}
          onPress={async () => {
            setSynthShareError(null);
            try {
              await shareCardImage(synthesisRef);
            } catch (e: any) {
              setSynthShareError(e?.message ?? 'Share failed');
            }
          }}>
          <Text style={cs.shareSynthesisText}>SHARE SYNTHESIS ↗</Text>
        </TouchableOpacity>
        {synthShareError !== null && (
          <Text style={[cs.errorText, {marginTop: 6}]}>{synthShareError}</Text>
        )}

        {/* New collision */}
        <TouchableOpacity
          style={cs.newBtn}
          onPress={() => navigation.popToTop()}>
          <Text style={cs.newBtnText}>NEW COLLISION →</Text>
        </TouchableOpacity>

        {/* Save problem to workspace */}
        <TouchableOpacity
          onPress={handleSaveProblemToWorkspace}
          disabled={savingWorkspace}
          style={cs.saveWorkspaceBtn}>
          <Text style={cs.saveWorkspaceBtnText}>
            {savingWorkspace ? 'SAVING...' : 'SAVE PROBLEM TO WORKSPACE'}
          </Text>
        </TouchableOpacity>
        <Animated.Text
          style={[cs.saveWorkspaceConfirm, {opacity: workspaceSavedOpacity}]}
          pointerEvents="none">
          SAVED TO WORKSPACE
        </Animated.Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const cs = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},

  // Off-screen hidden share card container
  // opacity must stay 1 — Android skips rendering opacity:0 views,
  // which would cause captureRef to capture a blank image.
  offScreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.mutedLight,
  },
  shareText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.accent,
  },
  scroll: {flex: 1},
  scrollContent: {paddingHorizontal: 20, paddingBottom: 60},

  // Essence
  essenceBlock: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    paddingLeft: 14,
    paddingVertical: 16,
    marginTop: 20,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: COLORS.muted,
    textTransform: 'uppercase',
  },
  essenceText: {
    fontFamily: 'serif',
    fontSize: 16,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 24,
    marginTop: 8,
  },

  // Card
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    marginBottom: 14,
    overflow: 'hidden',
  },
  cardBar: {height: 2},
  cardContent: {padding: 16},

  // Breadcrumb
  breadcrumb: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.muted,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Domain row
  domainRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  domainDot: {width: 8, height: 8, marginRight: 8},
  domainName: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: COLORS.mutedLight,
  },

  // Card text
  cardTitle: {
    fontFamily: 'serif',
    fontSize: 17,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: 10,
  },
  cardBody: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 20,
  },
  divider: {height: 1, backgroundColor: COLORS.border, marginVertical: 14},
  bridgeLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    marginBottom: 6,
  },
  bridgeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: COLORS.mutedLight,
    lineHeight: 20,
  },

  // Go Deeper
  deeperBtn: {paddingVertical: 4},
  deeperText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: COLORS.accentRed,
    marginTop: 6,
  },

  // Share card (within card)
  shareCardBtn: {paddingVertical: 4},
  shareCardText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Share synthesis (below synthesis card)
  shareSynthesisBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  shareSynthesisText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.accent,
    textTransform: 'uppercase',
  },

  // Loading dots
  loadingRow: {alignItems: 'flex-start', paddingVertical: 8},
  loadingDots: {flexDirection: 'row', gap: 6, marginBottom: 8},
  dot: {width: 6, height: 6, backgroundColor: COLORS.accent},
  loadingText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: COLORS.accent,
  },

  // Synthesis
  synthesisCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 16,
  },
  synthesisTag: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: COLORS.accent,
    marginBottom: 10,
  },
  synthesisText: {
    fontFamily: 'serif',
    fontSize: 15,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 24,
  },

  // New collision button
  newBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  newBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.background,
    fontWeight: '700',
  },
  saveWorkspaceBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  saveWorkspaceBtnText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#64c8f0',
    textTransform: 'uppercase',
  },
  saveWorkspaceConfirm: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#64c8f0',
    textAlign: 'center',
    marginBottom: 24,
  },
});
