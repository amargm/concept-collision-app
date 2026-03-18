/**
 * WorkspaceScreen — full list view of saved problems.
 * Tab screen (no back button). Reads from problems/{uid}/items in Firestore.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  FlatList,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {auth, firestore} from '../services/firebase';
import type {RootStackParamList} from '../../App';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:          '#0a0a0a',
  surface:     '#111111',
  card:        '#141414',
  border:      '#222222',
  accent:      '#c8f064',
  accentRed:   '#f06464',
  accentBlue:  '#64c8f0',
  accentPurple:'#c064f0',
  text:        '#e8e8e0',
  muted:       '#555550',
  mutedLight:  '#999990',
  label:       '#888880',
};

// ── Stage config ──────────────────────────────────────────────────────────────
type Stage = 'waiting' | 'thinking' | 'resting' | 'clear' | 'let go';

const STAGE_COLOR: Record<Stage, string> = {
  waiting:  '#555550',
  thinking: '#c8f064',
  resting:  '#64c8f0',
  clear:    '#c064f0',
  'let go': '#222222',
};

// Luminance rule: #c8f064 and #64c8f0 → dark text; others → white
const STAGE_TEXT_ON_FILL: Record<Stage, string> = {
  waiting:  '#ffffff',
  thinking: '#0a0a0a',
  resting:  '#0a0a0a',
  clear:    '#ffffff',
  'let go': '#ffffff',
};

const STAGES: Stage[] = ['waiting', 'thinking', 'resting', 'clear', 'let go'];
const STAGE_LABELS: Record<Stage, string> = {
  waiting:  'WAITING',
  thinking: 'THINKING',
  resting:  'RESTING',
  clear:    'CLEAR',
  'let go': 'LET GO',
};

// ── Category colour for domain tags ──────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<string, string> = {
  Biology: 'Biology|ecology|evolution|genetics|microbiology|neuroscience|anatomy|botany|zoology|marine|organism|cellular|bacteria|virus|dna|gene|species|bird|insect|plant|fungus|mycology|immunology',
  History: 'history|medieval|ancient|roman|greek|renaissance|war|empire|colonial|ottoman|civilization|dynasty|feudal|victorian|industrial|tribe|archaeological|mythology',
  Physics: 'physics|thermodynamics|quantum|mechanics|astronomy|chemistry|geology|mathematics|statistics|fluid|optics|electromagnetic|nuclear|cosmology|astrophysics|crystallography|metallurgy|acoustics',
  Ecology: 'ecology|environment|climate|ocean|wildlife|conservation|agriculture|permaculture|watershed|ecosystem|habitat|biodiversity|soil|coral|reef|forestry|drought|hydrology',
};
const CATEGORY_COLORS: Record<string, string> = {
  Biology: '#64c8f0',
  History: '#c8f064',
  Physics: '#f06464',
  Ecology: '#c064f0',
  Other:   '#888880',
};

function domainCategory(domain: string): string {
  const lower = domain.toLowerCase();
  for (const [cat, pattern] of Object.entries(CATEGORY_KEYWORDS)) {
    if (new RegExp(pattern, 'i').test(lower)) return cat;
  }
  return 'Other';
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Problem {
  id: string;
  problem: string;
  stage: Stage;
  source: string;
  collisionCount: number;
  collisionIds: string[];
  domains: string[];
  createdAt: any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(ts: any): string {
  if (!ts) return '';
  const ms = ts.toDate ? ts.toDate().getTime() : Date.now();
  const diff = Date.now() - ms;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Loading dots ──────────────────────────────────────────────────────────────
function LoadingDots() {
  const d = [
    useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.4)).current,
  ];
  useEffect(() => {
    const anims = d.map((dot, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 200),
        Animated.timing(dot, {toValue: 1, duration: 400, useNativeDriver: true}),
        Animated.timing(dot, {toValue: 0.4, duration: 400, useNativeDriver: true}),
        Animated.delay((2 - i) * 200),
      ])),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={s.loadingWrap}>
      <View style={s.loadingDots}>
        {d.map((dot, i) => <Animated.View key={i} style={[s.dot, {opacity: dot}]} />)}
      </View>
      <Text style={s.loadingLabel}>LOADING WORKSPACE...</Text>
    </View>
  );
}

// ── Domain tag ────────────────────────────────────────────────────────────────
function DomainTag({domain}: {domain: string}) {
  const cat   = domainCategory(domain);
  const color = CATEGORY_COLORS[cat];
  return (
    <View style={[s.tag, {borderColor: color}]}>
      <Text style={[s.tagText, {color}]} numberOfLines={1}>{domain.toUpperCase()}</Text>
    </View>
  );
}

// ── Problem card ──────────────────────────────────────────────────────────────
function ProblemCard({item, onPress, onLongPress}: {
  item: Problem;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const stageColor = STAGE_COLOR[item.stage] ?? C.muted;
  const visibleDomains = item.domains.slice(0, 4);
  const extra = item.domains.length - visibleDomains.length;

  return (
    <TouchableWithoutFeedback onPress={onPress} onLongPress={onLongPress} delayLongPress={400}>
      <View style={[s.card, {borderLeftColor: stageColor}]}>
        {/* Top row: stage label + meta */}
        <View style={s.cardTopRow}>
          <Text style={[s.stageLabel, {color: stageColor}]}>
            {STAGE_LABELS[item.stage] ?? item.stage.toUpperCase()}
          </Text>
          <Text style={s.cardMeta}>
            {item.collisionCount > 0 ? `${item.collisionCount} collision${item.collisionCount !== 1 ? 's' : ''} · ` : ''}
            {relativeTime(item.createdAt)}
          </Text>
        </View>

        {/* Problem text */}
        <Text style={s.cardProblem} numberOfLines={2} ellipsizeMode="tail">
          {item.problem}
        </Text>

        {/* Domain tags */}
        {item.domains.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.tagsScroll}
            contentContainerStyle={s.tagsRow}>
            {visibleDomains.map((d, i) => <DomainTag key={i} domain={d} />)}
            {extra > 0 && (
              <Text style={s.tagsExtra}>+{extra} more</Text>
            )}
          </ScrollView>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function WorkspaceScreen() {
  const navigation = useNavigation<NavProp>();
  const [problems,  setProblems]  = useState<Problem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeFilter, setActiveFilter] = useState<Stage | 'all'>('all');

  // Subscribe to Firestore problems realtime
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) { setLoading(false); return; }

    const unsub = firestore()
      .collection('problems')
      .doc(user.uid)
      .collection('items')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snap => {
          const docs: Problem[] = snap.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<Problem, 'id'>),
          }));
          setProblems(docs);
          setLoading(false);
        },
        () => setLoading(false),
      );
    return () => unsub();
  }, []);

  const filtered = activeFilter === 'all'
    ? problems
    : problems.filter(p => p.stage === activeFilter);

  // ── Long-press action sheet ───────────────────────────────────────────────
  const handleLongPress = (item: Problem) => {
    const stageOptions = STAGES.filter(s => s !== item.stage).map(s => STAGE_LABELS[s]);
    const options = [...stageOptions.map(l => `Move to ${l}`), 'Delete Problem', 'Cancel'];
    const destructiveIndex = options.length - 2;
    const cancelIndex = options.length - 1;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {options, destructiveButtonIndex: destructiveIndex, cancelButtonIndex: cancelIndex},
        async buttonIndex => {
          if (buttonIndex === cancelIndex) return;
          if (buttonIndex === destructiveIndex) {
            await deleteProblem(item.id);
          } else {
            const targetStage = STAGES.filter(s => s !== item.stage)[buttonIndex];
            await changeStage(item.id, targetStage);
          }
        },
      );
    } else {
      // Android: Alert-based action sheet
      Alert.alert(
        'Problem Actions',
        item.problem.slice(0, 60) + (item.problem.length > 60 ? '…' : ''),
        [
          ...STAGES.filter(st => st !== item.stage).map(st => ({
            text: `Move to ${STAGE_LABELS[st]}`,
            onPress: () => changeStage(item.id, st),
          })),
          {
            text: 'Delete Problem',
            style: 'destructive' as const,
            onPress: () => confirmDelete(item.id),
          },
          {text: 'Cancel', style: 'cancel' as const},
        ],
      );
    }
  };

  const changeStage = async (id: string, stage: Stage) => {
    const user = auth().currentUser;
    if (!user) return;
    await firestore()
      .collection('problems').doc(user.uid).collection('items').doc(id)
      .update({stage});
  };

  const deleteProblem = async (id: string) => {
    const user = auth().currentUser;
    if (!user) return;
    await firestore()
      .collection('problems').doc(user.uid).collection('items').doc(id)
      .delete();
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      'Delete Problem',
      'This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete', style: 'destructive', onPress: () => deleteProblem(id)},
      ],
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>WORKSPACE</Text>
        <View style={s.headerRight}>
          <Text style={s.headerSearch}>SEARCH</Text>
          <Text style={s.headerView}>LIST</Text>
        </View>
      </View>

      {/* Stage filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filtersScroll}
        contentContainerStyle={s.filtersRow}>
        {/* ALL chip */}
        <TouchableOpacity
          onPress={() => setActiveFilter('all')}
          style={[
            s.chip,
            activeFilter === 'all'
              ? {backgroundColor: C.accent, borderColor: C.accent}
              : {backgroundColor: C.surface, borderColor: C.border},
          ]}>
          <Text style={[
            s.chipText,
            {color: activeFilter === 'all' ? '#0a0a0a' : C.muted},
          ]}>ALL</Text>
        </TouchableOpacity>

        {STAGES.map(stage => {
          const isActive = activeFilter === stage;
          const fillColor = STAGE_COLOR[stage];
          return (
            <TouchableOpacity
              key={stage}
              onPress={() => setActiveFilter(stage)}
              style={[
                s.chip,
                isActive
                  ? {backgroundColor: fillColor, borderColor: fillColor}
                  : {backgroundColor: C.surface, borderColor: C.border},
              ]}>
              <Text style={[
                s.chipText,
                {color: isActive ? STAGE_TEXT_ON_FILL[stage] : C.muted},
              ]}>{STAGE_LABELS[stage]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <LoadingDots />
      ) : problems.length === 0 ? (
        // Global empty state
        <View style={s.emptyWrap}>
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>Your workspace is empty.</Text>
            <Text style={s.emptyBody}>
              Save a problem from the home screen to start thinking deeply.
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.filterEmptyWrap}>
              <Text style={s.filterEmptyText}>Nothing here yet.</Text>
            </View>
          }
          renderItem={({item}) => (
            <ProblemCard
              item={item}
              onPress={() => navigation.navigate('ProblemDetail', {problemId: item.id})}
              onLongPress={() => handleLongPress(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: C.bg},

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: C.label,
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  headerSearch: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: C.muted,
  },
  headerView: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: C.accent,
  },

  // Filter chips
  filtersScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 10,
  },

  // Problem card
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  cardMeta: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
    color: C.label,
  },
  cardProblem: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.text,
    lineHeight: 20,
    marginBottom: 10,
  },

  // Domain tags
  tagsScroll: {flexGrow: 0},
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  tag: {
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: C.surface,
  },
  tagText: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 1,
  },
  tagsExtra: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: C.muted,
    marginLeft: 2,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  dot: {
    width: 6,
    height: 6,
    backgroundColor: C.accent,
  },
  loadingLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: C.mutedLight,
  },

  // Empty states
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  emptyCard: {
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    paddingLeft: 16,
    paddingVertical: 8,
  },
  emptyTitle: {
    fontFamily: 'serif',
    fontSize: 15,
    fontStyle: 'italic',
    color: C.text,
    marginBottom: 10,
  },
  emptyBody: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.mutedLight,
    lineHeight: 18,
  },
  filterEmptyWrap: {
    paddingTop: 40,
    alignItems: 'center',
  },
  filterEmptyText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: C.muted,
  },
});
