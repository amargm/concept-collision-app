/**
 * CollisionMapScreen
 *
 * Visual Domain Atlas — a force-directed graph of all domains that have
 * appeared in collisions across all users. Nodes sized by frequency,
 * coloured by category. Pannable + pinch-zoomable via PanResponder.
 * Tap a node → bottom sheet with domain name, count, top problems.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import {BACKEND_URL} from '../utils/constants';
import ForceGraph from '../components/ForceGraph';
import type {FGNode} from '../components/ForceGraph';

const {width: SW, height: SH} = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a',
  card: '#141414',
  border: '#222222',
  accent: '#c8f064',
  text: '#e8e8e0',
  muted: '#555550',
  mutedLight: '#999990',
  error: '#f06464',
};

// Category colours and matching text colour (luminance rule from design system)
const CATEGORY_FILL: Record<string, string> = {
  Biology: '#64c8f0',
  History: '#c8f064',
  Physics: '#f06464',
  Ecology: '#c064f0',
  Other:   '#888880',
};
const CATEGORY_TEXT: Record<string, string> = {
  Biology: '#0a0a0a',
  History: '#0a0a0a',
  Physics: '#ffffff',
  Ecology: '#ffffff',
  Other:   '#ffffff',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface MapNode {
  id: string;
  domain: string;
  count: number;
  category: string;
  topProblems: string[];
}
interface MapEdge {
  source: string;
  target: string;
  weight: number;
}
interface MapData {
  nodes: MapNode[];
  edges: MapEdge[];
  totalCollisions: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function nodeRadius(count: number, maxCount: number): number {
  // 20 – 50 px range
  return 20 + Math.round((count / maxCount) * 30);
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
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, {toValue: 1,   duration: 400, useNativeDriver: true}),
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
    <View style={{flexDirection: 'row', gap: 8, marginBottom: 14}}>
      {d.map((dot, i) => (
        <Animated.View
          key={i}
          style={{width: 6, height: 6, backgroundColor: C.accent, opacity: dot}}
        />
      ))}
    </View>
  );
}

// ── Legend item ───────────────────────────────────────────────────────────────
function LegendItem({category}: {category: string}) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, {backgroundColor: CATEGORY_FILL[category]}]} />
      <Text style={s.legendLabel}>{category.toUpperCase()}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
const SHEET_H = 300;

export default function CollisionMapScreen() {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [selected, setSelected] = useState<MapNode | null>(null);

  // Bottom sheet animation
  const sheetY = useRef(new Animated.Value(SHEET_H)).current;

  const openSheet = (node: MapNode) => {
    setSelected(node);
    Animated.timing(sheetY, {toValue: 0, duration: 260, useNativeDriver: true}).start();
  };
  const closeSheet = () => {
    Animated.timing(sheetY, {toValue: SHEET_H, duration: 220, useNativeDriver: true}).start(
      () => setSelected(null),
    );
  };

  // ── Fetch map data ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = auth().currentUser;
        if (!user) throw new Error('Not signed in');
        const token = await user.getIdToken();
        const resp  = await fetch(`${BACKEND_URL}/map`, {
          headers: {Authorization: `Bearer ${token}`},
        });
        if (!resp.ok) throw new Error(`Server error ${resp.status}`);
        const data: MapData = await resp.json();
        if (!cancelled) {
          setMapData(data);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load map');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={s.topBar}>
          <Text style={s.screenTitle}>MAP</Text>
        </View>
        <View style={s.centered}>
          <LoadingDots />
          <Text style={s.scanText}>SCANNING DOMAINS...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={s.topBar}>
          <Text style={s.screenTitle}>MAP</Text>
        </View>
        <View style={s.centered}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  const totalCollisions = mapData?.totalCollisions ?? 0;
  const hasEnough = (mapData?.nodes.length ?? 0) > 0;

  if (!hasEnough) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={s.topBar}>
          <Text style={s.screenTitle}>MAP</Text>
        </View>
        <View style={s.centered}>
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>
              The map grows as more collisions are created.
            </Text>
            {totalCollisions > 0 && (
              <Text style={s.emptyMeta}>
                {totalCollisions} / 50 COLLISIONS
              </Text>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Graph ──────────────────────────────────────────────────────────────────
  const nodes    = mapData!.nodes;
  const edges    = mapData!.edges;
  const maxCount = Math.max(...nodes.map(n => n.count), 1);
  const graphH   = SH - 90; // leave room for top bar

  // Map domain nodes → generic FGNodes
  const fgNodes: FGNode[] = nodes.map(n => ({
    id:        n.id,
    label:     n.domain,
    color:     CATEGORY_FILL[n.category]  ?? '#888880',
    textColor: CATEGORY_TEXT[n.category]  ?? '#ffffff',
    size:      nodeRadius(n.count, maxCount),
    data:      n,
  }));

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.screenTitle}>MAP</Text>
        <Text style={s.subtitle}>{nodes.length} DOMAINS · {totalCollisions} COLLISIONS</Text>
      </View>

      {/* Graph — ForceGraph owns pan/zoom/tap */}
      <View style={{flex: 1}}>
        <ForceGraph
          nodes={fgNodes}
          edges={edges}
          onNodeTap={fgNode => openSheet(fgNode.data as MapNode)}
          onEmptyTap={closeSheet}
          width={SW}
          height={graphH}
          selectedId={selected?.id}
        />

        {/* Legend — overlaid bottom-left */}
        <View style={s.legend}>
          {Object.keys(CATEGORY_FILL).map(cat => (
            <LegendItem key={cat} category={cat} />
          ))}
        </View>
      </View>

      {/* Bottom sheet */}
      <Animated.View
        style={[s.sheet, {transform: [{translateY: sheetY}]}]}
        pointerEvents={selected ? 'auto' : 'none'}
      >
        {selected && (
          <>
            <View style={s.sheetHandle} />

            {/* Header row */}
            <View style={s.sheetHeader}>
              <View style={s.sheetDomainRow}>
                <View
                  style={[
                    s.sheetDot,
                    {backgroundColor: CATEGORY_FILL[selected.category] ?? '#888880'},
                  ]}
                />
                <Text style={s.sheetDomain}>{selected.domain.toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={closeSheet} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Text style={s.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={s.sheetDivider} />

            {/* Stats */}
            <View style={s.sheetRow}>
              <Text style={s.sheetLabel}>CATEGORY</Text>
              <Text style={s.sheetValue}>{selected.category}</Text>
            </View>
            <View style={s.sheetRow}>
              <Text style={s.sheetLabel}>APPEARANCES</Text>
              <Text style={s.sheetValue}>{selected.count}</Text>
            </View>

            {/* Top problems */}
            {selected.topProblems?.length > 0 && (
              <>
                <View style={s.sheetDivider} />
                <Text style={s.sheetLabel}>TOP PROBLEMS SOLVED</Text>
                {selected.topProblems.map((p, i) => (
                  <Text key={i} style={s.sheetProblem} numberOfLines={2}>
                    {`${i + 1}. ${p}`}
                  </Text>
                ))}
              </>
            )}
          </>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  screenTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 3,
    color: C.accent,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: C.mutedLight,
    marginTop: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scanText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: C.mutedLight,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.error,
    textAlign: 'center',
  },
  emptyCard: {
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    paddingLeft: 16,
    paddingVertical: 8,
  },
  emptyText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.mutedLight,
    lineHeight: 18,
  },
  emptyMeta: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: C.muted,
    marginTop: 10,
  },
  // Legend
  legend: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
  },
  legendLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 2,
    color: C.mutedLight,
  },
  // Bottom sheet
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 32,
    height: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetDomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetDot: {
    width: 8,
    height: 8,
  },
  sheetDomain: {
    fontFamily: 'monospace',
    fontSize: 13,
    letterSpacing: 2,
    color: C.text,
  },
  sheetClose: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: C.mutedLight,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 12,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#888880',
    textTransform: 'uppercase',
  },
  sheetValue: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.text,
  },
  sheetProblem: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.mutedLight,
    lineHeight: 16,
    marginTop: 6,
  },
});
