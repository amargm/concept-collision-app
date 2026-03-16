import React, {useRef, useState} from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const ONBOARDING_KEY = 'onboarding_complete';

// ── Page data ─────────────────────────────────────────────────────────────────
type PageKey = 'intro' | 'card' | 'cta';
const PAGES: PageKey[] = ['intro', 'card', 'cta'];

// ── Sub-components ────────────────────────────────────────────────────────────
function PageIntro() {
  return (
    <View style={styles.page}>
      <View style={styles.pageContent}>
        <View style={styles.titleBlock}>
          <Text style={styles.titleWord}>Concept</Text>
          <Text style={[styles.titleWord, styles.titleAccent]}>Collision</Text>
        </View>
        <Text style={styles.body}>
          Describe any problem. Get 4 collision cards from wildly unrelated
          domains that solved the same structural challenge.
        </Text>
      </View>
    </View>
  );
}

function PageCard() {
  return (
    <View style={styles.page}>
      <View style={styles.pageContent}>
        <Text style={styles.sectionLabel}>EXAMPLE COLLISION</Text>
        <View style={styles.card}>
          <View style={styles.cardBar} />
          <View style={styles.cardInner}>
            <Text style={styles.domainLabel}>MEDIEVAL GUILD SYSTEMS</Text>
            <Text style={styles.cardTitle}>
              How guilds revoked master craftsman trust
            </Text>
            <Text style={styles.cardBody}>
              When a master craftsman violated guild ethics, trust revocation
              required a formal vote by the guild council — no single authority
              could act alone. Charges were heard publicly and evidence reviewed
              before any credential was stripped.
            </Text>
            <View style={styles.divider} />
            <Text style={styles.bridgeLabel}>STRUCTURAL BRIDGE</Text>
            <Text style={styles.bridgeText}>
              Trust revocation required social consensus — no authority could
              act alone.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function PageCta({onContinue}: {onContinue: () => void}) {
  return (
    <View style={styles.page}>
      <View style={styles.pageContent}>
        <Text style={styles.ctaHeadline}>10 free collisions{'\n'}every month.</Text>
        <Text style={styles.body}>
          No API key required. Sign in to save your results and unlock more.
        </Text>
      </View>
      <TouchableOpacity style={styles.continueBtn} onPress={onContinue} activeOpacity={0.85}>
        <Text style={styles.continueBtnText}>CONTINUE →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingScreen({navigation}: Props) {
  const flatListRef = useRef<FlatList<PageKey>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.replace('Auth');
  };

  const onViewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({viewAreaCoveragePercentThreshold: 50}).current;

  const renderItem = ({item}: {item: PageKey}) => {
    switch (item) {
      case 'intro': return <PageIntro />;
      case 'card':  return <PageCard />;
      case 'cta':   return <PageCta onContinue={completeOnboarding} />;
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Skip button */}
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={completeOnboarding}
        hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
        <Text style={styles.skipText}>SKIP</Text>
      </TouchableOpacity>

      {/* Pages */}
      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderItem}
        keyExtractor={(item: PageKey) => item}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {PAGES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  // ── Skip ────────────────────────────────────────────────────────────────────
  skipBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skipText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#555550',
  },

  // ── Page ────────────────────────────────────────────────────────────────────
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  pageContent: {
    flex: 1,
    justifyContent: 'center',
  },

  // ── Page 1 ──────────────────────────────────────────────────────────────────
  titleBlock: {
    marginBottom: 28,
  },
  titleWord: {
    fontFamily: 'serif',
    fontSize: 32,
    color: '#e8e8e0',
    lineHeight: 40,
  },
  titleAccent: {
    fontStyle: 'italic',
    color: '#c8f064',
  },
  body: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#999990',
    lineHeight: 22,
  },

  // ── Page 2 — card ───────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#888880',
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222222',
  },
  cardBar: {
    height: 2,
    backgroundColor: '#c8f064',
  },
  cardInner: {
    padding: 16,
  },
  domainLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#c8f064',
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#e8e8e0',
    marginBottom: 10,
    lineHeight: 20,
  },
  cardBody: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#999990',
    lineHeight: 19,
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#222222',
    marginBottom: 10,
  },
  bridgeLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#888880',
    marginBottom: 6,
  },
  bridgeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#e8e8e0',
    lineHeight: 19,
  },

  // ── Page 3 — CTA ────────────────────────────────────────────────────────────
  ctaHeadline: {
    fontFamily: 'serif',
    fontSize: 20,
    color: '#e8e8e0',
    lineHeight: 30,
    marginBottom: 20,
  },
  continueBtn: {
    backgroundColor: '#c8f064',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  continueBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: '#0a0a0a',
  },

  // ── Dots ────────────────────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  dot: {
    width: 6,
    height: 6,
  },
  dotActive: {
    backgroundColor: '#c8f064',
  },
  dotInactive: {
    backgroundColor: '#333333',
  },
});
