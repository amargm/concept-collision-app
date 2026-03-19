/**
 * SearchScreen — Global search across History (historyIndex) and Workspace
 * (workspaceIndex) from search_index/{uid} in Firestore.
 * Filters: ALL | HISTORY | WORKSPACE
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {auth, firestore} from '../services/firebase';
import type {RootStackParamList} from '../../App';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type Filter  = 'all' | 'history' | 'workspace';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:          '#0a0a0a',
  surface:     '#111111',
  card:        '#141414',
  border:      '#222222',
  accent:      '#c8f064',
  accentRed:   '#f06464',
  text:        '#e8e8e0',
  muted:       '#555550',
  mutedLight:  '#999990',
  label:       '#888880',
};

const STAGE_COLOR: Record<string, string> = {
  waiting:  '#555550',
  thinking: '#c8f064',
  resting:  '#64c8f0',
  clear:    '#c064f0',
  'let go': '#222222',
};
const STAGE_TEXT: Record<string, string> = {
  waiting:  '#ffffff',
  thinking: '#0a0a0a',
  resting:  '#0a0a0a',
  clear:    '#ffffff',
  'let go': '#ffffff',
};
const STAGE_LABELS: Record<string, string> = {
  waiting:  'WAITING',
  thinking: 'THINKING',
  resting:  'RESTING',
  clear:    'CLEAR',
  'let go': 'LET GO',
};

// ── Result types ──────────────────────────────────────────────────────────────
interface HistoryEntry {
  kind:         'history';
  collisionId:  string;
  problemText:  string;
  domains:      string[];
  timestamp:    any;   // Firestore Timestamp or ms
}

interface WorkspaceEntry {
  kind:       'workspace';
  problemId:  string;
  text:       string;
  stage:      string;
  domains:    string[];
  updatedAt:  any;
}

type ResultItem = HistoryEntry | WorkspaceEntry;

function tsToMs(ts: any): number {
  if (!ts) {return 0;}
  if (ts.toMillis) {return ts.toMillis();}
  if (ts.toDate)   {return ts.toDate().getTime();}
  if (ts.seconds)  {return ts.seconds * 1000;}
  if (typeof ts === 'number') {return ts;}
  return 0;
}

function formatDate(ts: any): string {
  const ms = tsToMs(ts);
  if (!ms) {return '';}
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const navigation = useNavigation<NavProp>();

  const [query,       setQuery]       = useState('');
  const [filter,      setFilter]      = useState<Filter>('all');
  const [inputFocused, setInputFocused] = useState(false);
  const [results,     setResults]     = useState<ResultItem[]>([]);
  const [indexData,   setIndexData]   = useState<{
    historyIndex:   HistoryEntry[];
    workspaceIndex: WorkspaceEntry[];
  } | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // ── Load search index once ────────────────────────────────────────────────
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {return;}
    firestore()
      .collection('search_index')
      .doc(user.uid)
      .get()
      .then(snap => {
        if (!snap.exists) {return;}
        const d = snap.data() ?? {};
        setIndexData({
          historyIndex:   (d.historyIndex   ?? []).map((e: any) => ({...e, kind: 'history'})),
          workspaceIndex: (d.workspaceIndex ?? []).map((e: any) => ({...e, kind: 'workspace'})),
        });
      })
      .catch(() => {});
  }, []);

  // ── Debounced search ──────────────────────────────────────────────────────
  const runSearch = useCallback((q: string, f: Filter) => {
    if (!indexData || !q.trim()) {
      setResults([]);
      return;
    }
    const lower = q.toLowerCase().trim();

    const historyHits: HistoryEntry[] = (filter === 'workspace')
      ? []
      : indexData.historyIndex.filter(e =>
          e.problemText?.toLowerCase().includes(lower) ||
          e.domains?.some((d: string) => d.toLowerCase().includes(lower)),
        );

    const workspaceHits: WorkspaceEntry[] = (filter === 'history')
      ? []
      : indexData.workspaceIndex.filter(e =>
          e.text?.toLowerCase().includes(lower) ||
          e.domains?.some((d: string) => d.toLowerCase().includes(lower)),
        );

    // Merge and sort by recency
    const merged: ResultItem[] = [
      ...historyHits,
      ...workspaceHits,
    ].sort((a, b) => {
      const tsA = a.kind === 'history' ? tsToMs(a.timestamp) : tsToMs(a.updatedAt);
      const tsB = b.kind === 'history' ? tsToMs(b.timestamp) : tsToMs(b.updatedAt);
      return tsB - tsA;
    });

    setResults(merged);
  }, [indexData, filter]);

  useEffect(() => {
    if (debounceTimer.current) {clearTimeout(debounceTimer.current);}
    debounceTimer.current = setTimeout(() => {
      runSearch(query, filter);
    }, 300);
    return () => {
      if (debounceTimer.current) {clearTimeout(debounceTimer.current);}
    };
  }, [query, filter, runSearch]);

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Navigation handlers ───────────────────────────────────────────────────
  const handleTapResult = (item: ResultItem) => {
    if (item.kind === 'workspace') {
      navigation.navigate('ProblemDetail', {problemId: item.problemId});
    } else {
      // For history results: go back to History screen
      // The History screen is in the root stack — navigate to it
      navigation.navigate('History');
    }
  };

  // ── Render result item ────────────────────────────────────────────────────
  const renderItem = ({item}: {item: ResultItem}) => {
    if (item.kind === 'history') {
      return (
        <TouchableOpacity
          style={s.resultRow}
          onPress={() => handleTapResult(item)}
          activeOpacity={0.75}>
          <View style={s.originChipH}>
            <Text style={s.originChipHText}>H</Text>
          </View>
          <View style={s.resultBody}>
            <Text style={s.resultText} numberOfLines={2}>{item.problemText}</Text>
            <Text style={s.resultMeta}>{formatDate(item.timestamp)}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    // workspace
    const stageColor = STAGE_COLOR[item.stage] ?? C.muted;
    const stageText  = STAGE_TEXT[item.stage]  ?? '#ffffff';
    const stageLabel = STAGE_LABELS[item.stage] ?? item.stage?.toUpperCase();
    return (
      <TouchableOpacity
        style={s.resultRow}
        onPress={() => handleTapResult(item)}
        activeOpacity={0.75}>
        <View style={s.originChipW}>
          <Text style={s.originChipWText}>W</Text>
        </View>
        <View style={s.resultBody}>
          <Text style={s.resultText} numberOfLines={2}>{item.text}</Text>
          <View style={s.resultFooter}>
            <View style={[s.stageChip, {backgroundColor: stageColor}]}>
              <Text style={[s.stageChipText, {color: stageText}]}>{stageLabel}</Text>
            </View>
            {(item.domains ?? []).slice(0, 3).map((d, i) => (
              <Text key={i} style={s.domainTag}>{d.toUpperCase()}</Text>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const showEmpty  = !query.trim();
  const showNone   = !!query.trim() && results.length === 0;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{top:12, bottom:12, left:12, right:12}}>
          <Text style={s.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>SEARCH</Text>
        <View style={{width: 60}} />
      </View>

      {/* Search input */}
      <View style={[s.inputWrap, {borderColor: inputFocused ? C.accent : C.border}]}>
        <TextInput
          ref={inputRef}
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="SEARCH YOUR THINKING"
          placeholderTextColor={C.muted}
          autoCorrect={false}
          autoCapitalize="none"
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
        />
      </View>

      {/* Filter toggle */}
      <View style={s.filterRow}>
        {(['all', 'history', 'workspace'] as Filter[]).map(f => {
          const active   = filter === f;
          const label    = f === 'all' ? 'ALL' : f === 'history' ? 'HISTORY' : 'WORKSPACE';
          return (
            <TouchableOpacity
              key={f}
              style={[s.filterSeg, active && s.filterSegActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}>
              <Text style={[s.filterSegText, active && s.filterSegTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Results / empty states */}
      {showEmpty ? (
        <View style={s.centerMsg}>
          <Text style={s.centerMsgText}>START TYPING TO SEARCH YOUR THINKING</Text>
        </View>
      ) : showNone ? (
        <View style={s.centerMsg}>
          <Text style={s.centerMsgText}>NOTHING FOUND</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, i) =>
            item.kind === 'history' ? `h-${item.collisionId}-${i}` : `w-${item.problemId}-${i}`
          }
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: C.bg},

  // Top bar
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 24,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backText: {
    fontFamily:    'monospace',
    fontSize:      11,
    letterSpacing: 2,
    color:         C.label,
    width:         60,
  },
  topTitle: {
    fontFamily:    'monospace',
    fontSize:      11,
    letterSpacing: 3,
    color:         C.label,
    textTransform: 'uppercase',
  },

  // Input
  inputWrap: {
    marginHorizontal: 24,
    marginTop:        16,
    marginBottom:     0,
    borderWidth:      1,
    backgroundColor:  C.surface,
  },
  input: {
    fontFamily:        'monospace',
    fontSize:          13,
    color:             C.text,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },

  // Filter toggle
  filterRow: {
    flexDirection:   'row',
    marginHorizontal: 24,
    marginTop:        12,
    marginBottom:     4,
    borderWidth:      1,
    borderColor:      C.border,
  },
  filterSeg: {
    flex:           1,
    paddingVertical: 8,
    alignItems:     'center',
    backgroundColor: C.surface,
  },
  filterSegActive: {
    backgroundColor: C.accent,
  },
  filterSegText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         C.muted,
    textTransform: 'uppercase',
  },
  filterSegTextActive: {
    color: '#0a0a0a',
    fontWeight: '600',
  },

  // Empty / no-results
  centerMsg: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  centerMsgText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    color:         C.muted,
    textTransform: 'uppercase',
    textAlign:     'center',
    paddingHorizontal: 32,
  },

  // Result rows
  resultRow: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap:             12,
  },

  // Origin chips
  originChipH: {
    backgroundColor: C.card,
    borderWidth:     1,
    borderColor:     C.border,
    paddingHorizontal: 6,
    paddingVertical:   3,
    alignItems:      'center',
    justifyContent:  'center',
    minWidth:        24,
    marginTop:       2,
  },
  originChipHText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1,
    color:         C.label,
    fontWeight:    '600',
  },
  originChipW: {
    backgroundColor: C.accent,
    paddingHorizontal: 6,
    paddingVertical:   3,
    alignItems:      'center',
    justifyContent:  'center',
    minWidth:        24,
    marginTop:       2,
  },
  originChipWText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1,
    color:         '#0a0a0a',
    fontWeight:    '600',
  },

  // Result body
  resultBody: {
    flex:    1,
    gap:     6,
  },
  resultText: {
    fontFamily: 'monospace',
    fontSize:   13,
    color:      C.text,
    lineHeight: 20,
  },
  resultMeta: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1.5,
    color:         C.label,
  },
  resultFooter: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           6,
  },

  // Stage chip (workspace results)
  stageChip: {
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  stageChipText: {
    fontFamily:    'monospace',
    fontSize:      8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Domain tags
  domainTag: {
    fontFamily:    'monospace',
    fontSize:      8,
    letterSpacing: 1,
    color:         C.label,
  },
});
