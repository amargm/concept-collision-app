/**
 * ProblemDetailScreen — Full thread view of a single workspace problem.
 * Thread items: COLLISION (compact 2×2 grid), NOTE, STAGE_CHANGE.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
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
import {auth, firestore} from '../services/firebase';
import type {RootStackParamList} from '../../App';
import type {CollisionResult, Collision} from '../hooks/useCollision';
import StagePicker from '../components/StagePicker';

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
type Stage = 'waiting' | 'thinking' | 'resting' | 'clear' | 'let go';

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
  createdAt: any;
}

interface CollisionDoc {
  id: string;
  problem: string;
  result: CollisionResult;
  timestamp: any;
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
  | {kind: 'collision';    sortTs: number; doc: CollisionDoc}
  | {kind: 'note';         sortTs: number; doc: NoteDoc}
  | {kind: 'stage_change'; sortTs: number; doc: StageEventDoc};

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

// ── Thread item: COLLISION ────────────────────────────────────────────────────
function CollisionThreadCard({
  doc,
  onPress,
}: {
  doc: CollisionDoc;
  onPress: () => void;
}) {
  const cols = doc.result?.collisions ?? [];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.collisionCard}>
      {/* 2px accent top bar */}
      <View style={[s.collisionBar, {backgroundColor: C.accent}]} />
      <View style={s.collisionCardContent}>
        <Text style={s.threadMetaLabel}>
          COLLISION · {formatThreadDate(doc.timestamp)}
        </Text>
        {/* 2×2 grid of compact domain cards */}
        <View style={s.domainGrid}>
          {cols.map((c, i) => (
            <CompactDomainCard
              key={i}
              collision={c}
              accentColor={CARD_ACCENT_COLORS[i] ?? C.accent}
            />
          ))}
        </View>
        <Text style={s.tapExpand}>TAP TO VIEW FULL →</Text>
      </View>
    </TouchableOpacity>
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

// ── Thread item dispatcher ────────────────────────────────────────────────────
function ThreadRow({
  item,
  onPressCollision,
}: {
  item: ThreadItem;
  onPressCollision: (doc: CollisionDoc) => void;
}) {
  if (item.kind === 'collision') {
    return (
      <CollisionThreadCard
        doc={item.doc}
        onPress={() => onPressCollision(item.doc)}
      />
    );
  }
  if (item.kind === 'note') {
    return <NoteThreadCard doc={item.doc} />;
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
  const [addingNote, setAddingNote]             = useState(false);
  const [noteText, setNoteText]                 = useState('');
  const [savingNote, setSavingNote]             = useState(false);
  const [stagePickerVisible, setStagePickerVisible] = useState(false);
  const [stagePickerHowEnd,  setStagePickerHowEnd]  = useState(false);

  const noteRef = useRef<TextInput>(null);

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
            id:             snap.id,
            problem:        data.problem        ?? '',
            stage:          (data.stage as Stage) ?? 'waiting',
            source:         data.source         ?? 'queued',
            collisionCount: data.collisionCount ?? 0,
            collisionIds:   data.collisionIds   ?? [],
            domains:        data.domains        ?? [],
            createdAt:      data.createdAt,
          });
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
    setStagePickerHowEnd(false);
    setStagePickerVisible(true);
  }, []);

  const handleHowDidEnd = useCallback(() => {
    setStagePickerHowEnd(true);
    setStagePickerVisible(true);
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

  const handleCollideAgain = useCallback(() => {
    if (!problem) {return;}
    // Navigate to Main tabs → Home tab with pre-filled problem text
    (navigation as any).navigate('Main', {
      screen: 'Home',
      params: {prefillProblem: problem.problem},
    });
  }, [navigation, problem]);

  const handlePressCollision = useCallback(
    (doc: CollisionDoc) => {
      navigation.navigate('Result', {
        problem: doc.problem || problem?.problem || '',
        result:  doc.result,
      });
    },
    [navigation, problem],
  );

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
      {/* COLLIDE AGAIN */}
      <TouchableOpacity style={s.collideAgainBtn} onPress={handleCollideAgain}>
        <Text style={s.collideAgainText}>COLLIDE AGAIN</Text>
      </TouchableOpacity>

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

      <View style={{height: 48}} />
    </View>
  );

  // ── Empty thread ──────────────────────────────────────────────────────────
  const ListEmpty = (
    <View style={s.emptyThread}>
      <Text style={s.emptyThreadText}>No thread items yet.</Text>
      <Text style={s.emptyThreadSub}>COLLIDE AGAIN to start a thread.</Text>
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
          data={thread}
          keyExtractor={(item, idx) => `${item.kind}-${idx}`}
          renderItem={({item}) => (
            <ThreadRow item={item} onPressCollision={handlePressCollision} />
          )}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={
            !loadingCollisions ? ListEmpty : null
          }
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>

      {/* ── Stage picker bottom sheet ── */}
      <StagePicker
        visible={stagePickerVisible}
        currentStage={problem.stage}
        onClose={() => setStagePickerVisible(false)}
        onStageChange={changeStage}
        startOnHowEnd={stagePickerHowEnd}
      />
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

  // ── Collision thread card ──
  collisionCard: {
    marginHorizontal: 24,
    marginBottom:     12,
    backgroundColor:  C.card,
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
});
