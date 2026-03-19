/**
 * ProblemDetailScreen — Full thread view of a single workspace problem.
 * Thread items: COLLISION (compact 2×2 grid), NOTE, STAGE_CHANGE.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {auth, firestore} from '../services/firebase';
import {BACKEND_URL} from '../utils/constants';
import type {RootStackParamList} from '../../App';
import type {CollisionResult, Collision, CollisionMode} from '../hooks/useCollision';
import StagePicker from '../components/StagePicker';
import ClosingSheet from '../components/ClosingSheet';
import ThreadCollisionCard from '../components/ThreadCollisionCard';
import type {Stage} from '../components/StagePicker';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteP  = RouteProp<RootStackParamList, 'ProblemDetail'>;

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           '#0a0a0a',
  surface:      '#111111',
  card:         '#141414',
  border:       '#222222',
  accent:       '#c8f064',
  accentRed:    '#f06464',
  accentBlue:   '#64c8f0',
  accentPurple: '#c064f0',
  text:         '#e8e8e0',
  muted:        '#555550',
  mutedLight:   '#999990',
  label:        '#888880',
};

// ── Stage config ──────────────────────────────────────────────────────────────
// ── Stage config (Stage type imported from StagePicker) ─────────────────────
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

const STAGES: Stage[] = ['waiting', 'thinking', 'resting', 'clear', 'let go'];

const STAGE_LABELS: Record<Stage, string> = {
  waiting:  'WAITING',
  thinking: 'THINKING',
  resting:  'RESTING',
  clear:    'CLEAR',
  'let go': 'LET GO',
};

// ── Category colours ──────────────────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<string, string> = {
  Biology: 'Biology|ecology|evolution|genetics|microbiology|neuroscience|anatomy|botany|zoology|marine|organism|cellular|bacteria|virus|dna|gene|species|bird|insect|plant|fungus|mycology|immunology',
  History: 'history|medieval|ancient|roman|greek|renaissance|war|empire|colonial|ottoman|civilization|dynasty|feudal|victorian|industrial|tribe|archaeological|mythology',
  Physics:  'physics|thermodynamics|quantum|mechanics|astronomy|chemistry|geology|mathematics|statistics|fluid|optics|electromagnetic|nuclear|cosmology|astrophysics|crystallography|metallurgy|acoustics',
  Ecology:  'ecology|environment|climate|ocean|wildlife|conservation|agriculture|permaculture|watershed|ecosystem|habitat|biodiversity|soil|coral|reef|forestry|drought|hydrology',
};

const CATEGORY_COLORS: Record<string, string> = {
  Biology: '#64c8f0',
  History: '#c8f064',
  Physics: '#f06464',
  Ecology: '#c064f0',
  Other:   '#888880',
};

// Contrast text colour per luminance rule
const CATEGORY_TEXT: Record<string, string> = {
  Biology: '#0a0a0a', // #64c8f0 → bright
  History: '#0a0a0a', // #c8f064 → bright
  Physics: '#ffffff', // #f06464 → dark-ish
  Ecology: '#ffffff', // #c064f0 → dark-ish
  Other:   '#ffffff',
};

const CARD_ACCENT_COLORS = ['#c8f064', '#64c8f0', '#f06464', '#c064f0'];

function domainCategory(domain: string): string {
  const lower = domain.toLowerCase();
  for (const [cat, pattern] of Object.entries(CATEGORY_KEYWORDS)) {
    if (new RegExp(pattern, 'i').test(lower)) {return cat;}
  }
  return 'Other';
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProblemDoc {
  id: string;
  problem: string;
  stage: Stage;
  source: string;
  collisionCount: number;
  collisionIds: string[];
  domains: string[];
  keyInsights: string[];   // e.g. ["abc123-0", "abc123-2"]
  createdAt: any;
  noteCount?: number;
  keyInsightCount?: number;
}

interface CollisionDoc {
  id: string;
  problem: string;
  result: CollisionResult & {narratives?: {domain: string; setting: string; story: string; bridge: string}[]};
  timestamp: any;
  mode?: string;
}

interface NoteDoc {
  id: string;
  text: string;
  createdAt: any;
}

interface StageEventDoc {
  id: string;
  type: 'stage_change';
  to: Stage;
  createdAt: any;
}

type ThreadItem =
  | {kind: 'collision';    sortTs: number; doc: CollisionDoc; collisionIndex: number}
  | {kind: 'note';         sortTs: number; doc: NoteDoc}
  | {kind: 'stage_change'; sortTs: number; doc: StageEventDoc}
  | {kind: 'loading';      sortTs: number; id: string};

// ── Helpers ───────────────────────────────────────────────────────────────────
function tsToMs(ts: any): number {
  if (!ts) {return 0;}
  if (ts.toDate) {return ts.toDate().getTime();}
  if (ts.seconds) {return ts.seconds * 1000;}
  return 0;
}

function formatAbsDate(ts: any): string {
  const ms = tsToMs(ts);
  if (!ms) {return '—';}
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).toUpperCase();
}

function formatShortDate(ts: any): string {
  const ms = tsToMs(ts);
  if (!ms) {return '';}
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'});
}

function formatThreadDate(ts: any): string {
  const ms = tsToMs(ts);
  if (!ms) {return '';}
  const d = new Date(ms);
  return (
    d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}) +
    ' · ' +
    d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})
  );
}

// ── Loading dots ──────────────────────────────────────────────────────────────
function LoadingDots({label = 'LOADING...'}: {label?: string}) {
  const d = [
    useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.4)).current,
  ];
  useEffect(() => {
    const anims = d.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, {toValue: 1, duration: 400, useNativeDriver: true}),
          Animated.timing(dot, {toValue: 0.4, duration: 400, useNativeDriver: true}),
          Animated.delay((2 - i) * 200),
        ]),
      ),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={s.loadingWrap}>
      <View style={s.loadingDots}>
        {d.map((dot, i) => (
          <Animated.View key={i} style={[s.dot, {opacity: dot}]} />
        ))}
      </View>
      <Text style={s.loadingLabel}>{label}</Text>
    </View>
  );
}

// ── Domain tag chip ───────────────────────────────────────────────────────────
function DomainTag({domain}: {domain: string}) {
  const cat   = domainCategory(domain);
  const color = CATEGORY_COLORS[cat];
  return (
    <View style={[s.tag, {borderColor: color}]}>
      <Text style={[s.tagText, {color}]}>{domain.toUpperCase()}</Text>
    </View>
  );
}

// ── Compact domain card — one domain inside a collision thread item ────────────
function CompactDomainCard({
  collision,
  accentColor,
}: {
  collision: Collision;
  accentColor: string;
}) {
  return (
    <View style={[s.compactDomain, {borderColor: C.border}]}>
      {/* 2px left accent bar */}
      <View style={[s.compactDomainBar, {backgroundColor: accentColor}]} />
      <View style={s.compactDomainInner}>
        <View style={[s.compactDomainTagWrap, {borderColor: accentColor}]}>
          <Text
            style={[s.compactDomainTagText, {color: accentColor}]}
            numberOfLines={1}>
            {collision.domain.toUpperCase()}
          </Text>
        </View>
        <Text style={s.compactBridgeText} numberOfLines={3}>
          {collision.bridge}
        </Text>
      </View>
    </View>
  );
}

// ── Thread item: COLLISION GROUP ─────────────────────────────────────────────
function CollisionThreadCard({
  doc,
  collisionIndex,
  keyInsights,
  expandedCards,
  onToggleKeyInsight,
  onToggleExpand,
}: {
  doc: CollisionDoc;
  collisionIndex: number;
  keyInsights: Set<string>;
  expandedCards: Set<string>;
  onToggleKeyInsight: (key: string) => void;
  onToggleExpand: (key: string) => void;
}) {
  const cols = doc.result?.collisions ?? [];
  const narrativeDomains: string[] =
    doc.mode === 'narrative'
      ? (doc.result?.narratives?.map(n => n.domain) ?? [])
      : [];

  const dateStr  = formatThreadDate(doc.timestamp);
  const modeStr  = doc.mode && doc.mode !== 'core' ? `  ·  ${doc.mode.toUpperCase()} MODE` : '';
  const groupNum = String(collisionIndex + 1);

  return (
    <View style={s.collisionGroup}>
      {/* ── Header row ─────────────────────────────────────────────── */}
      <View style={s.collisionGroupHeader}>
        <View style={s.headerLine} />
        <Text style={s.collisionGroupLabel} numberOfLines={1}>
          {`  ${dateStr}  COLLISION ${groupNum}${modeStr}  `}
        </Text>
        <View style={s.headerLine} />
      </View>

      {/* ── 4 ThreadCollisionCards ──────────────────────────────────── */}
      {cols.length > 0
        ? cols.map((col, i) => {
            const kiKey = `${doc.id}-${i}`;
            return (
              <ThreadCollisionCard
                key={kiKey}
                card={col}
                cardIndex={i}
                isKeyInsight={keyInsights.has(kiKey)}
                expanded={expandedCards.has(kiKey)}
                onToggleExpand={() => onToggleExpand(kiKey)}
                onMarkKeyInsight={() => onToggleKeyInsight(kiKey)}
                onRemoveKeyInsight={() => onToggleKeyInsight(kiKey)}
              />
            );
          })
        : narrativeDomains.length > 0 ? (
            <Text style={s.narrativeDomainLine}>
              {narrativeDomains.join(' · ')}
            </Text>
          ) : null}
    </View>
  );
}

// ── Thread item: NOTE ─────────────────────────────────────────────────────────
function NoteThreadCard({doc}: {doc: NoteDoc}) {
  return (
    <View style={s.noteCard}>
      <Text style={s.noteText}>{doc.text}</Text>
      <Text style={s.noteTimestamp}>{formatThreadDate(doc.createdAt)}</Text>
    </View>
  );
}

// ── Thread item: STAGE CHANGE ─────────────────────────────────────────────────
function StageChangeMarker({doc}: {doc: StageEventDoc}) {
  const label   = STAGE_LABELS[doc.to] ?? doc.to.toUpperCase();
  const dateStr = formatShortDate(doc.createdAt);
  return (
    <View style={s.stageChangeRow}>
      <Text style={s.stageChangeText}>
        {`Stage changed to ${label} — ${dateStr}`}
      </Text>
    </View>
  );
}

// ── Thread item: COLLISION LOADING ───────────────────────────────────────────
function CollisionLoadingItem() {
  return (
    <View style={[s.collisionCard, {marginBottom: 12}]}>
      <View style={[s.collisionBar, {backgroundColor: C.accent}]} />
      <View style={[s.collisionCardContent, {alignItems: 'center', paddingVertical: 28}]}>
        <LoadingDots label="THINKING..." />
      </View>
    </View>
  );
}

// ── Thread item dispatcher ────────────────────────────────────────────────────
function ThreadRow({
  item,
  keyInsights,
  expandedCards,
  onToggleKeyInsight,
  onToggleExpand,
}: {
  item: ThreadItem;
  keyInsights: Set<string>;
  expandedCards: Set<string>;
  onToggleKeyInsight: (key: string) => void;
  onToggleExpand: (key: string) => void;
}) {
  if (item.kind === 'collision') {
    return (
      <CollisionThreadCard
        doc={item.doc}
        collisionIndex={item.collisionIndex}
        keyInsights={keyInsights}
        expandedCards={expandedCards}
        onToggleKeyInsight={onToggleKeyInsight}
        onToggleExpand={onToggleExpand}
      />
    );
  }
  if (item.kind === 'note') {
    return <NoteThreadCard doc={item.doc} />;
  }
  if (item.kind === 'loading') {
    return <CollisionLoadingItem />;
  }
  return <StageChangeMarker doc={item.doc} />;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProblemDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteP>();
  const {problemId} = route.params;

  const [problem, setProblem]             = useState<ProblemDoc | null>(null);
  const [collisionDocs, setCollisionDocs] = useState<CollisionDoc[]>([]);
  const [notes, setNotes]                 = useState<NoteDoc[]>([]);
  const [events, setEvents]               = useState<StageEventDoc[]>([]);
  const [loadingProblem, setLoadingProblem]       = useState(true);
  const [loadingCollisions, setLoadingCollisions] = useState(false);
  const [addingNote, setAddingNote]                   = useState(false);
  const [noteText, setNoteText]                       = useState('');
  const [savingNote, setSavingNote]                   = useState(false);
  const [stagePickerVisible, setStagePickerVisible]   = useState(false);
  const [closingSheetVisible, setClosingSheetVisible] = useState(false);
  const [closingTargetStage, setClosingTargetStage]   = useState<Stage>('clear');
  const [collideMode, setCollideModeRaw] = useState<CollisionMode>('core');
  const [colliding, setColliding]       = useState(false);
  const [collideError, setCollideError] = useState<string | null>(null);
  const [keyInsights, setKeyInsights]   = useState<Set<string>>(new Set<string>());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set<string>());
  const savedConfirmOpacity = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const noteRef = useRef<TextInput>(null);

  // Persist collide mode across sessions
  const setCollideMode = useCallback((m: CollisionMode) => {
    setCollideModeRaw(m);
    AsyncStorage.setItem('workspace_collide_mode', m);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('workspace_collide_mode').then(v => {
      if (v === 'core' || v === 'learning' || v === 'narrative') {
        setCollideModeRaw(v);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Subscribe to problem doc ──────────────────────────────────────────────
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {return;}
    const unsub = firestore()
      .collection('problems')
      .doc(user.uid)
      .collection('items')
      .doc(problemId)
      .onSnapshot(
        snap => {
          if (!snap.exists) {
            setLoadingProblem(false);
            return;
          }
          const data = snap.data() ?? {};
          setProblem({
            id:                snap.id,
            problem:           data.problem        ?? '',
            stage:             (data.stage as Stage) ?? 'waiting',
            source:            data.source         ?? 'queued',
            collisionCount:    data.collisionCount ?? 0,
            collisionIds:      data.collisionIds   ?? [],
            domains:           data.domains        ?? [],
            keyInsights:       data.keyInsights    ?? [],
            noteCount:         data.noteCount      ?? 0,
            keyInsightCount:   data.keyInsightCount ?? 0,
            createdAt:         data.createdAt,
          });
          // Seed key-insight state from Firestore on first load only
          setKeyInsights(prev =>
            prev.size === 0 && data.keyInsights?.length
              ? new Set<string>(data.keyInsights as string[])
              : prev,
          );
          setLoadingProblem(false);
        },
        () => setLoadingProblem(false),
      );
    return unsub;
  }, [problemId]);

  // ── Fetch collision docs whenever collisionIds change ─────────────────────
  useEffect(() => {
    if (!problem) {return;}
    const user = auth().currentUser;
    if (!user || problem.collisionIds.length === 0) {
      setCollisionDocs([]);
      return;
    }
    setLoadingCollisions(true);
    Promise.all(
      problem.collisionIds.map(cid =>
        firestore()
          .collection('collisions')
          .doc(user.uid)
          .collection('items')
          .doc(cid)
          .get(),
      ),
    )
      .then(snaps => {
        const docs: CollisionDoc[] = snaps
          .filter(s => s.exists)
          .map(s => {
            const d = s.data() ?? {};
            return {
              id:        s.id,
              problem:   d.problem ?? '',
              result:    d.result  ?? {structural_essence: '', collisions: [], synthesis: ''},
              timestamp: d.timestamp,
              mode:      d.mode ?? 'core',
            };
          });
        setCollisionDocs(docs);
      })
      .catch(() => setCollisionDocs([]))
      .finally(() => setLoadingCollisions(false));
  // Depend on the joined string so reference equality doesn't block updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem?.collisionIds.join(','), problemId]);

  // ── Subscribe to notes ────────────────────────────────────────────────────
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {return;}
    const unsub = firestore()
      .collection('problems')
      .doc(user.uid)
      .collection('items')
      .doc(problemId)
      .collection('notes')
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        snap => {
          setNotes(
            snap.docs.map(d => ({
              id:        d.id,
              text:      d.data().text      ?? '',
              createdAt: d.data().createdAt,
            })),
          );
        },
        () => {},
      );
    return unsub;
  }, [problemId]);

  // ── Subscribe to stage-change events ─────────────────────────────────────
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {return;}
    const unsub = firestore()
      .collection('problems')
      .doc(user.uid)
      .collection('items')
      .doc(problemId)
      .collection('events')
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        snap => {
          setEvents(
            snap.docs.map(d => ({
              id:        d.id,
              type:      'stage_change' as const,
              to:        d.data().to as Stage,
              createdAt: d.data().createdAt,
            })),
          );
        },
        () => {},
      );
    return unsub;
  }, [problemId]);

  // ── Build chronological thread ────────────────────────────────────────────
  const thread: ThreadItem[] = [
    ...collisionDocs.map(doc => ({
      kind:   'collision' as const,
      sortTs: tsToMs(doc.timestamp),
      doc,
      collisionIndex: 0, // assigned below after sort
    })),
    ...notes.map(doc => ({
      kind:   'note' as const,
      sortTs: tsToMs(doc.createdAt),
      doc,
    })),
    ...events.map(doc => ({
      kind:   'stage_change' as const,
      sortTs: tsToMs(doc.createdAt),
      doc,
    })),
  ].sort((a, b) => a.sortTs - b.sortTs);

  // Assign sequential collisionIndex to collision items
  let collisionIndexCounter = 0;
  for (const item of thread) {
    if (item.kind === 'collision') {
      item.collisionIndex = collisionIndexCounter++;
    }
  }

  // Append inline loading sentinel when a collide is in-flight
  if (colliding) {
    thread.push({kind: 'loading', sortTs: Date.now() + 1, id: 'inline-loading'});
  }

  // ── Stage change handler ──────────────────────────────────────────────────
  const changeStage = useCallback(
    async (newStage: Stage) => {
      const user = auth().currentUser;
      if (!user || !problem || problem.stage === newStage) {return;}
      const ref = firestore()
        .collection('problems')
        .doc(user.uid)
        .collection('items')
        .doc(problemId);
      // Write new stage + append to stageHistory array (client timestamp — server
      // timestamps cannot be nested inside arrayUnion values)
      await ref.update({
        stage: newStage,
        stageHistory: firestore.FieldValue.arrayUnion({
          from: problem.stage,
          to:   newStage,
          at:   new Date().toISOString(),
        }),
      });
      await ref.collection('events').add({
        type:      'stage_change',
        to:        newStage,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    },
    [problem, problemId],
  );

  const handlePickStage = useCallback(() => {
    setStagePickerVisible(true);
  }, []);

  const handleSelectClosingStage = useCallback((stage: Stage) => {
    setClosingTargetStage(stage);
    setClosingSheetVisible(true);
  }, []);

  const handleHowDidEnd = useCallback(() => {
    setStagePickerVisible(true);
  }, []);

  const handleSaved = useCallback(() => {
    Animated.sequence([
      Animated.timing(savedConfirmOpacity, {toValue: 1, duration: 200, useNativeDriver: true}),
      Animated.delay(2000),
      Animated.timing(savedConfirmOpacity, {toValue: 0, duration: 300, useNativeDriver: true}),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveNote = useCallback(async () => {
    if (!noteText.trim() || savingNote) {return;}
    const user = auth().currentUser;
    if (!user) {return;}
    setSavingNote(true);
    try {
      await firestore()
        .collection('problems')
        .doc(user.uid)
        .collection('items')
        .doc(problemId)
        .collection('notes')
        .add({
          text:      noteText.trim(),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      setNoteText('');
      setAddingNote(false);
    } catch {
      // silently ignore
    } finally {
      setSavingNote(false);
    }
  }, [noteText, savingNote, problemId]);

  const handleInlineCollide = useCallback(async () => {
    if (!problem || colliding) {return;}
    const user = auth().currentUser;
    if (!user) {return;}
    setColliding(true);
    setCollideError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${BACKEND_URL}/collide`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          problem:             problem.problem,
          mode:                collideMode,
          workspaceProblemId:  problemId,
        }),
      });
      if (res.status === 429) {
        const b = await res.json().catch(() => ({}));
        setCollideError(
          b?.error === 'limit_exceeded'
            ? 'Monthly limit reached. Upgrade to continue.'
            : 'Too many requests.',
        );
        return;
      }
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setCollideError(b?.error ?? `Server error ${res.status}`);
        return;
      }
      const body = await res.json();
      const newDoc: CollisionDoc = {
        id:        body.id,
        problem:   problem.problem,
        result:    body.result,
        timestamp: new Date(),
        mode:      collideMode,
      };
      setCollisionDocs(prev => [...prev, newDoc]);
      // Persist collision ID so thread rebuilds correctly on re-visit
      await firestore()
        .collection('problems')
        .doc(user.uid)
        .collection('items')
        .doc(problemId)
        .update({
          collisionIds: firestore.FieldValue.arrayUnion(body.id),
        });
      setTimeout(() => flatListRef.current?.scrollToEnd({animated: true}), 150);
    } catch (e: any) {
      setCollideError(e?.message ?? 'Something went wrong');
    } finally {
      setColliding(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem, problemId, collideMode, colliding]);

  const handleCollideAgain = useCallback(() => {
    // retained for external use only — not used by action bar
  }, []);

  const toggleExpand = useCallback((kiKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(kiKey)) { next.delete(kiKey); } else { next.add(kiKey); }
      return next;
    });
  }, []);

  const toggleKeyInsight = useCallback((key: string) => {
    // Optimistic local update
    setKeyInsights(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      // Background Firestore write
      const user = auth().currentUser;
      if (user) {
        const ref = firestore()
          .collection('problems')
          .doc(user.uid)
          .collection('items')
          .doc(problemId);
        const adding = !prev.has(key);
        const newKeys = adding
          ? [...Array.from(prev), key]
          : Array.from(prev).filter(k => k !== key);
        const keyInsightCount = newKeys.length;
        // Read current collisionCount + noteCount from latest problem state
        ref.get().then(snap => {
          const d = snap.data() ?? {};
          const collisionCount = d.collisionCount ?? 0;
          const noteCount = d.noteCount ?? 0;
          const engagementScore = collisionCount + (noteCount * 0.5) + keyInsightCount;
          ref.update({
            keyInsights:      newKeys,
            keyInsightCount,
            engagementScore,
          });
        }).catch(() => {/* non-fatal */});
      }
      return next;
    });
  }, [problemId]);

  // ── Collect all unique domains across collision docs ──────────────────────
  const allDomains: string[] = [];
  collisionDocs.forEach(cd => {
    (cd.result?.collisions ?? []).forEach(c => {
      if (!allDomains.includes(c.domain)) {allDomains.push(c.domain);}
    });
  });
  if (allDomains.length === 0 && problem) {
    problem.domains.forEach(d => {
      if (!allDomains.includes(d)) {allDomains.push(d);}
    });
  }

  // ── Loading / not-found states ────────────────────────────────────────────
  if (loadingProblem) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.backText}>← BACK</Text>
          </TouchableOpacity>
        </View>
        <LoadingDots />
      </SafeAreaView>
    );
  }

  if (!problem) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.backText}>← BACK</Text>
          </TouchableOpacity>
        </View>
        <View style={s.notFound}>
          <Text style={s.notFoundText}>Problem not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stageColor     = STAGE_COLOR[problem.stage] ?? C.muted;
  const stageTextColor = STAGE_TEXT[problem.stage]  ?? '#ffffff';
  const isClosing      = problem.stage === 'clear' || problem.stage === 'let go';
  const sourceLabel    = problem.source === 'elevated' ? 'ELEVATED' : 'QUEUED';

  // ── Render-time lookups for key insight mini-cards ────────────────────────
  // kiKey → {domain, title, cardIndex}
  const kiKeyData = new Map<string, {domain: string; title: string; cardIndex: number; collisionId: string}>();
  for (const doc of collisionDocs) {
    for (let i = 0; i < (doc.result?.collisions ?? []).length; i++) {
      const col = doc.result.collisions[i];
      kiKeyData.set(`${doc.id}-${i}`, {domain: col.domain, title: col.title, cardIndex: i, collisionId: doc.id});
    }
  }
  // collisionId → FlatList index
  const collisionIdToIdx = new Map<string, number>();
  thread.forEach((item, idx) => {
    if (item.kind === 'collision') {collisionIdToIdx.set(item.doc.id, idx);}
  });

  const scrollToAndExpand = (kiKey: string) => {
    const lastDash = kiKey.lastIndexOf('-');
    const collisionId = kiKey.slice(0, lastDash);
    const idx = collisionIdToIdx.get(collisionId);
    if (idx !== undefined) {
      try {
        flatListRef.current?.scrollToIndex({index: idx, animated: true, viewOffset: 20});
      } catch {}
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.add(kiKey);
      return next;
    });
  };

  // Key insight cards array — passed to ClosingSheet for ritual selection
  const keyInsightCards = Array.from(keyInsights)
    .map(kiKey => {
      const data = kiKeyData.get(kiKey);
      if (!data) {return null;}
      return {
        kiKey,
        collisionId: data.collisionId,
        cardIndex:   data.cardIndex,
        domain:      data.domain,
        title:       data.title,
        accentColor: CARD_ACCENT_COLORS[data.cardIndex] ?? C.accent,
        domainColor: CATEGORY_COLORS[domainCategory(data.domain)] ?? C.label,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // ── FlatList header ───────────────────────────────────────────────────────
  const ListHeader = (
    <>
      {/* Problem text */}
      <View style={s.problemBlock}>
        <Text style={s.problemText}>{problem.problem}</Text>
      </View>

      {/* Meta row */}
      <Text style={s.metaRow}>
        {`SAVED ${formatAbsDate(problem.createdAt)} · ${sourceLabel} · ${problem.collisionCount} COLLISION${problem.collisionCount !== 1 ? 'S' : ''}`}
      </Text>

      {/* Domain tags */}
      {allDomains.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.domainsScroll}
          contentContainerStyle={s.domainsRow}>
          {allDomains.map((d, i) => (
            <DomainTag key={i} domain={d} />
          ))}
        </ScrollView>
      )}

      {/* KEY INSIGHTS summary — only when at least one insight is marked */}
      {keyInsights.size > 0 && (
        <>
          <View style={s.kiHeaderRow}>
            <View style={s.kiHeaderLine} />
            <Text style={s.kiHeaderLabel}>KEY INSIGHTS</Text>
            <View style={s.kiHeaderLine} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.kiScroll}
            contentContainerStyle={s.kiScrollContent}>
            {Array.from(keyInsights).map(kiKey => {
              const data = kiKeyData.get(kiKey);
              if (!data) {return null;}
              const accentColor = CARD_ACCENT_COLORS[data.cardIndex] ?? C.accent;
              const catColor    = CATEGORY_COLORS[domainCategory(data.domain)] ?? C.label;
              const truncTitle  = data.title.length > 40
                ? data.title.slice(0, 40) + '…'
                : data.title;
              return (
                <TouchableOpacity
                  key={kiKey}
                  style={[s.kiMiniCard, {borderLeftColor: accentColor}]}
                  onPress={() => scrollToAndExpand(kiKey)}
                  activeOpacity={0.75}>
                  <Text style={s.kiStar}>★</Text>
                  <Text style={[s.kiDomain, {color: catColor}]} numberOfLines={1}>
                    {data.domain.toUpperCase()}
                  </Text>
                  <Text style={s.kiTitle} numberOfLines={2}>{truncTitle}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Thread label */}
      <View style={s.threadLabelRow}>
        <Text style={s.sectionLabel}>THREAD</Text>
        {loadingCollisions && (
          <Text style={s.threadLoadingText}>LOADING...</Text>
        )}
      </View>
    </>
  );

  // ── FlatList footer ───────────────────────────────────────────────────────
  const ListFooter = (
    <View style={s.footer}>
      {/* Inline collide error */}
      {collideError !== null && (
        <Text style={s.collideErrorText}>{collideError}</Text>
      )}

      {/* ADD NOTE */}
      <TouchableOpacity
        style={s.addNoteBtn}
        onPress={() => {
          setAddingNote(v => {
            if (!v) {setTimeout(() => noteRef.current?.focus(), 80);}
            return !v;
          });
        }}>
        <Text style={s.addNoteText}>{addingNote ? 'CANCEL NOTE' : 'ADD NOTE'}</Text>
      </TouchableOpacity>

      {/* Inline note input */}
      {addingNote && (
        <View style={s.noteInputWrap}>
          <TextInput
            ref={noteRef}
            style={s.noteInput}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Write a note..."
            placeholderTextColor={C.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <View style={s.noteActions}>
            <TouchableOpacity
              onPress={() => {
                setAddingNote(false);
                setNoteText('');
              }}>
              <Text style={s.cancelText}>DISCARD</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveNote}
              disabled={!noteText.trim() || savingNote}>
              <Text
                style={[
                  s.saveNoteText,
                  (!noteText.trim() || savingNote) && s.saveNoteDisabled,
                ]}>
                {savingNote ? 'SAVING...' : 'SAVE NOTE'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* HOW DID THIS END? — only when not already in a closing stage */}
      {!isClosing && (
        <TouchableOpacity style={s.howEndWrap} onPress={handleHowDidEnd}>
          <Text style={s.howEndText}>HOW DID THIS END?</Text>
        </TouchableOpacity>
      )}

      <View style={{height: 16}} />
    </View>
  );

  // ── Empty thread ──────────────────────────────────────────────────────────
  const ListEmpty = (
    <View style={s.emptyThread}>
      <Text style={s.emptyThreadText}>No thread items yet.</Text>
      <Text style={s.emptyThreadSub}>Tap COLLIDE below to begin.</Text>
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.stageChip, {backgroundColor: stageColor}]}
          onPress={handlePickStage}>
          <Text style={[s.stageChipText, {color: stageTextColor}]}>
            {STAGE_LABELS[problem.stage]}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Thread ── */}
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef}
          data={thread}
          keyExtractor={(item, idx) =>
            item.kind === 'loading' ? 'loading' : `${item.kind}-${idx}`
          }
          renderItem={({item}) => (
            <ThreadRow
              item={item}
              keyInsights={keyInsights}
              expandedCards={expandedCards}
              onToggleKeyInsight={toggleKeyInsight}
              onToggleExpand={toggleExpand}
            />
          )}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={
            !loadingCollisions ? ListEmpty : null
          }
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
        />
        {/* ── Fixed action bar (inside KAV so it moves with keyboard) ── */}
        <View style={s.actionBar}>
          {/* NOTE stub — Gap 5: floating note pill */}
          <TouchableOpacity
            onPress={() => {
              setAddingNote(v => {
                if (!v) {setTimeout(() => noteRef.current?.focus(), 80);}
                return !v;
              });
              // TODO Gap 5: replace with floating note pill
            }}>
            <Text style={s.actionBarNote}>NOTE</Text>
          </TouchableOpacity>

          {/* Mode toggle: PROBLEM | CONCEPT | STORY */}
          <View style={s.modeToggle}>
            {(['core', 'learning', 'narrative'] as CollisionMode[]).map((m, i) => {
              const labels = ['PROBLEM', 'CONCEPT', 'STORY'];
              const active  = collideMode === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[s.modeSeg, active && s.modeSegActive]}
                  onPress={() => setCollideMode(m)}
                  activeOpacity={0.8}>
                  <Text style={[s.modeSegText, active && s.modeSegTextActive]}>
                    {labels[i]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* COLLIDE button */}
          <TouchableOpacity
            style={[s.collideBtn, colliding && s.collideBtnBusy]}
            onPress={handleInlineCollide}
            disabled={colliding}
            activeOpacity={0.8}>
            <Text style={s.collideBtnText}>COLLIDE</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Stage picker bottom sheet ── */}
      <StagePicker
        visible={stagePickerVisible}
        currentStage={problem.stage}
        onClose={() => setStagePickerVisible(false)}
        onStageChange={changeStage}
        onSelectClosingStage={handleSelectClosingStage}
      />

      {/* ── Closing sheet ── */}
      <ClosingSheet
        visible={closingSheetVisible}
        targetStage={closingTargetStage}
        problemId={problemId}
        keyInsightCards={keyInsightCards}
        onClose={() => setClosingSheetVisible(false)}
        onSaved={handleSaved}
      />

      {/* ── Saved confirmation ── */}
      <Animated.View
        style={[s.savedConfirm, {opacity: savedConfirmOpacity}]}
        pointerEvents="none">
        <Text style={s.savedConfirmText}>Saved.</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  flex:      {flex: 1},
  container: {flex: 1, backgroundColor: C.bg},

  // ── Header ──
  topBar: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 24,
    paddingVertical:  14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backText: {
    fontFamily:  'monospace',
    fontSize:    11,
    letterSpacing: 2,
    color:       C.label,
  },
  stageChip: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       'transparent',
  },
  stageChipText: {
    fontFamily:  'monospace',
    fontSize:    9,
    letterSpacing: 2,
    fontWeight:  '600',
  },

  // ── List container ──
  listContent: {
    paddingHorizontal: 0,
    paddingBottom:     16,
  },

  // ── Problem block ──
  problemBlock: {
    paddingHorizontal: 24,
    paddingTop:        28,
    paddingBottom:     12,
  },
  problemText: {
    fontFamily: 'serif',
    fontSize:   18,
    color:      C.text,
    lineHeight: 28,
  },

  // ── Meta row ──
  metaRow: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         C.label,
    paddingHorizontal: 24,
    marginBottom:  14,
  },

  // ── Domain tags ──
  domainsScroll: {marginBottom: 6},
  domainsRow: {
    flexDirection:  'row',
    gap:            8,
    paddingHorizontal: 24,
    paddingVertical:   4,
  },
  tag: {
    borderWidth:     1,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  tagText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1.5,
  },

  // ── Thread section label ──
  threadLabelRow: {
    flexDirection:      'row',
    alignItems:         'center',
    justifyContent:     'space-between',
    paddingHorizontal:  24,
    marginTop:          24,
    marginBottom:       10,
  },
  sectionLabel: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 3,
    color:         C.label,
    textTransform: 'uppercase',
  },
  threadLoadingText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         C.muted,
  },

  // ── Loading ──
  loadingWrap: {alignItems: 'center', paddingVertical: 40},
  loadingDots: {flexDirection: 'row', gap: 8, marginBottom: 12},
  dot:         {width: 8, height: 8, backgroundColor: C.accent},
  loadingLabel: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 3,
    color:         C.accent,
  },

  // ── Not found ──
  notFound: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  notFoundText: {
    fontFamily:    'monospace',
    fontSize:      11,
    letterSpacing: 2,
    color:         C.muted,
  },

  // ── Collision thread card wrapper ──
  collisionCard: {
    marginHorizontal: 24,
    marginBottom:     12,
    backgroundColor:  C.bg,
    borderWidth:      1,
    borderColor:      C.border,
  },
  collisionBar: {
    height: 2,
    width:  '100%',
  },
  collisionCardContent: {
    padding: 14,
  },

  // ── Collision group (new design) ──
  collisionGroup: {
    marginHorizontal: 24,
    marginBottom:     16,
  },
  collisionGroupHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   10,
  },
  headerLine: {
    flex:            1,
    height:          1,
    backgroundColor: '#222222',
  },
  collisionGroupLabel: {
    fontFamily:    'monospace',
    fontSize:      10,
    color:         '#333333',
    letterSpacing: 0.5,
    flexShrink:    1,
  },
  threadMetaLabel: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         C.label,
    marginBottom:  12,
  },
  // 2×2 grid of compact domain cards
  domainGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  compactDomain: {
    width:           '47.5%',
    borderWidth:     1,
    backgroundColor: C.surface,
    flexDirection:   'row',
    overflow:        'hidden',
  },
  compactDomainBar: {
    width: 2,
  },
  compactDomainInner: {
    flex:    1,
    padding: 8,
  },
  compactDomainTagWrap: {
    borderWidth:      1,
    alignSelf:        'flex-start',
    paddingHorizontal: 5,
    paddingVertical:   2,
    marginBottom:     6,
  },
  compactDomainTagText: {
    fontFamily:    'monospace',
    fontSize:      8,
    letterSpacing: 1,
  },
  compactBridgeText: {
    fontFamily: 'monospace',
    fontSize:   10,
    color:      C.mutedLight,
    lineHeight: 15,
  },
  tapExpand: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1.5,
    color:         C.muted,
    marginTop:     10,
    textAlign:     'right',
  },

  // ── Note thread card ──
  noteCard: {
    marginHorizontal: 24,
    marginBottom:     12,
    backgroundColor:  C.surface,
    borderLeftWidth:  1,
    borderLeftColor:  '#333333',
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  noteText: {
    fontFamily: 'monospace',
    fontSize:   12,
    color:      C.mutedLight,
    lineHeight: 19,
    marginBottom: 6,
  },
  noteTimestamp: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1,
    color:         C.muted,
  },

  // ── Stage change marker ──
  stageChangeRow: {
    marginHorizontal: 24,
    marginBottom:     14,
    alignItems:       'center',
  },
  stageChangeText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1.5,
    color:         '#333333',
  },

  // ── Footer actions ──
  footer: {
    paddingHorizontal: 24,
    marginTop:         24,
  },
  collideAgainBtn: {
    backgroundColor: C.accent,
    paddingVertical: 16,
    alignItems:      'center',
    marginBottom:    12,
  },
  collideAgainText: {
    fontFamily:    'monospace',
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 3,
    color:         '#0a0a0a',
  },
  addNoteBtn: {
    borderWidth:     1,
    borderColor:     C.border,
    paddingVertical: 14,
    alignItems:      'center',
    marginBottom:    12,
  },
  addNoteText: {
    fontFamily:    'monospace',
    fontSize:      11,
    letterSpacing: 3,
    color:         C.muted,
  },

  // ── Inline note input ──
  noteInputWrap: {
    borderWidth:     1,
    borderColor:     C.border,
    backgroundColor: C.surface,
    marginBottom:    12,
  },
  noteInput: {
    fontFamily:    'monospace',
    fontSize:      12,
    color:         C.text,
    padding:       14,
    minHeight:     100,
    textAlignVertical: 'top',
  },
  noteActions: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: 14,
    paddingVertical:  10,
    borderTopWidth:  1,
    borderTopColor:  C.border,
  },
  cancelText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         C.muted,
  },
  saveNoteText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         C.accent,
  },
  saveNoteDisabled: {
    color: C.muted,
  },

  // ── HOW DID THIS END? ──
  howEndWrap: {
    alignItems:  'center',
    paddingVertical: 16,
  },
  howEndText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         C.muted,
  },

  // ── Empty thread ──
  emptyThread: {
    paddingHorizontal: 24,
    paddingVertical:   20,
  },
  emptyThreadText: {
    fontFamily:    'monospace',
    fontSize:      11,
    letterSpacing: 2,
    color:         C.muted,
    marginBottom:  6,
  },
  emptyThreadSub: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         C.muted,
  },

  // ── Saved confirmation ──
  savedConfirm: {
    position:   'absolute' as const,
    bottom:     40,
    left:       0,
    right:      0,
    alignItems: 'center' as const,
  },
  savedConfirmText: {
    fontFamily:      'monospace',
    fontSize:        11,
    letterSpacing:   2,
    color:           '#c8f064',
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 16,
    paddingVertical:   6,
    borderWidth:     1,
    borderColor:     '#222222',
  },

  // ── Action bar ──
  actionBar: {
    flexDirection:     'row',
    alignItems:        'center',
    height:            60,
    paddingHorizontal: 16,
    backgroundColor:   C.surface,
    borderTopWidth:    1,
    borderTopColor:    C.border,
    gap:               10,
  },
  actionBarNote: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         C.muted,
    textTransform: 'uppercase',
  },
  modeToggle: {
    flex:          1,
    flexDirection: 'row',
  },
  modeSeg: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  modeSegActive: {
    backgroundColor: C.accent,
  },
  modeSegText: {
    fontFamily:    'monospace',
    fontSize:      8,
    letterSpacing: 1,
    color:         C.muted,
    textTransform: 'uppercase',
  },
  modeSegTextActive: {
    color: '#0a0a0a',
  },
  collideBtn: {
    width:          100,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
  },
  collideBtnBusy: {
    opacity: 0.6,
  },
  collideBtnText: {
    fontFamily:    'monospace',
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 3,
    color:         '#0a0a0a',
    textTransform: 'uppercase',
  },

  // ── Inline collide error ──
  collideErrorText: {
    fontFamily:        'monospace',
    fontSize:          10,
    color:             C.accentRed,
    paddingVertical:   8,
    paddingHorizontal: 0,
    marginBottom:      8,
  },

  // ── Narrative domain line (inside collision thread card) ──
  narrativeDomainLine: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1.5,
    color:         C.mutedLight,
    marginBottom:  10,
  },

  // ── KEY INSIGHTS header row + mini-card strip ──
  kiHeaderRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 24,
    marginTop:       20,
    marginBottom:    10,
  },
  kiHeaderLine: {
    flex:            1,
    height:          1,
    backgroundColor: C.border,
  },
  kiHeaderLabel: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 3,
    color:         C.accent,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
  },
  kiScroll: {
    marginBottom: 8,
  },
  kiScrollContent: {
    paddingHorizontal: 24,
    gap:           8,
    paddingVertical: 4,
  },
  kiMiniCard: {
    backgroundColor: C.bg,
    borderLeftWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width:         140,
  },
  kiStar: {
    fontFamily:  'monospace',
    fontSize:    11,
    color:       C.accent,
    marginBottom: 3,
  },
  kiDomain: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1.5,
    marginBottom:  4,
  },
  kiTitle: {
    fontFamily: 'monospace',
    fontSize:   11,
    color:      C.text,
    lineHeight: 16,
  },
});
