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
  PanResponder,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {Circle, G, Line, Text as SvgText} from 'react-native-svg';
import auth from '@react-native-firebase/auth';
import {BACKEND_URL} from '../utils/constants';

const {width: SW, height: SH} = Dimensions.get('window');
const CANVAS = 900; // virtual SVG canvas size

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

function touchDist(touches: {pageX: number; pageY: number}[]): number {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Force simulation (runs synchronously before first render) ─────────────────
function runSim(
  nodes: MapNode[],
  edges: MapEdge[],
): Record<string, {x: number; y: number}> {
  const N = nodes.length;
  if (N === 0) return {};

  const REPULSION  = 18000;
  const SPRING_LEN = 180;
  const SPRING_K   = 0.04;
  const CENTER_K   = 0.006;
  const DAMPING    = 0.72;

  // Start on a circle so there's no degenerate overlap
  const pos = nodes.map((_, i) => {
    const angle = (2 * Math.PI * i) / N;
    return {
      x: CANVAS / 2 + Math.cos(angle) * 220,
      y: CANVAS / 2 + Math.sin(angle) * 220,
      vx: 0,
      vy: 0,
    };
  });

  const edgeIdx = edges
    .map(e => ({
      si: nodes.findIndex(n => n.id === e.source),
      ti: nodes.findIndex(n => n.id === e.target),
    }))
    .filter(e => e.si !== -1 && e.ti !== -1);

  for (let iter = 0; iter < 300; iter++) {
    const fx = new Array(N).fill(0);
    const fy = new Array(N).fill(0);

    // Coulomb repulsion
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        const d2 = dx * dx + dy * dy || 1;
        const d  = Math.sqrt(d2);
        const f  = REPULSION / d2;
        const nx = dx / d, ny = dy / d;
        fx[i] -= f * nx; fy[i] -= f * ny;
        fx[j] += f * nx; fy[j] += f * ny;
      }
    }

    // Spring attraction along edges
    for (const {si, ti} of edgeIdx) {
      const dx = pos[ti].x - pos[si].x;
      const dy = pos[ti].y - pos[si].y;
      const d  = Math.sqrt(dx * dx + dy * dy) || 1;
      const f  = SPRING_K * (d - SPRING_LEN);
      const nx = dx / d, ny = dy / d;
      fx[si] += f * nx; fy[si] += f * ny;
      fx[ti] -= f * nx; fy[ti] -= f * ny;
    }

    // Centering pull
    for (let i = 0; i < N; i++) {
      fx[i] += CENTER_K * (CANVAS / 2 - pos[i].x);
      fy[i] += CENTER_K * (CANVAS / 2 - pos[i].y);
    }

    // Euler step with damping
    for (let i = 0; i < N; i++) {
      pos[i].vx = (pos[i].vx + fx[i]) * DAMPING;
      pos[i].vy = (pos[i].vy + fy[i]) * DAMPING;
      pos[i].x += pos[i].vx;
      pos[i].y += pos[i].vy;
    }
  }

  const PAD = 60;
  const result: Record<string, {x: number; y: number}> = {};
  nodes.forEach((node, i) => {
    result[node.id] = {
      x: Math.max(PAD, Math.min(CANVAS - PAD, pos[i].x)),
      y: Math.max(PAD, Math.min(CANVAS - PAD, pos[i].y)),
    };
  });
  return result;
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
  const [mapData, setMapData]   = useState<MapData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, {x: number; y: number}>>({});
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [displayTf, setDisplayTf] = useState({x: 0, y: 0, scale: 1});

  // Pan/zoom maintained in refs so PanResponder callbacks are always fresh
  const offsetX    = useRef(0);
  const offsetY    = useRef(0);
  const scaleVal   = useRef(1);
  const startX     = useRef(0);
  const startY     = useRef(0);
  const startScale = useRef(1);
  const lastDist   = useRef<number | null>(null);
  const didMove    = useRef(false);

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

  // Tap handler stored in ref so PanResponder closure always has fresh data
  const handleTapRef = useRef<(sx: number, sy: number) => void>(() => {});
  handleTapRef.current = (svgX: number, svgY: number) => {
    if (!mapData || Object.keys(positions).length === 0) return;
    const maxCount = Math.max(...mapData.nodes.map(n => n.count), 1);
    for (const node of mapData.nodes) {
      const pos = positions[node.id];
      if (!pos) continue;
      const r  = nodeRadius(node.count, maxCount);
      const dx = svgX - pos.x;
      const dy = svgY - pos.y;
      if (dx * dx + dy * dy <= r * r) {
        openSheet(node);
        return;
      }
    }
    if (selected) closeSheet();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: evt => {
        startX.current     = offsetX.current;
        startY.current     = offsetY.current;
        startScale.current = scaleVal.current;
        didMove.current    = false;
        const t = evt.nativeEvent.touches;
        lastDist.current = t.length >= 2 ? touchDist(t as any) : null;
      },
      onPanResponderMove: (evt, gesture) => {
        const t = evt.nativeEvent.touches;
        if (t.length >= 2) {
          didMove.current = true;
          const d = touchDist(t as any);
          if (lastDist.current && lastDist.current > 0) {
            scaleVal.current = Math.max(0.25, Math.min(5, startScale.current * (d / lastDist.current)));
            setDisplayTf({x: offsetX.current, y: offsetY.current, scale: scaleVal.current});
          }
        } else {
          if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) didMove.current = true;
          offsetX.current = startX.current + gesture.dx;
          offsetY.current = startY.current + gesture.dy;
          setDisplayTf({x: offsetX.current, y: offsetY.current, scale: scaleVal.current});
        }
      },
      onPanResponderRelease: evt => {
        if (!didMove.current) {
          const tapX = evt.nativeEvent.locationX;
          const tapY = evt.nativeEvent.locationY;
          const svgX = (tapX - offsetX.current) / scaleVal.current;
          const svgY = (tapY - offsetY.current) / scaleVal.current;
          handleTapRef.current(svgX, svgY);
        }
      },
    }),
  ).current;

  // Fetch map data
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
          // Run simulation synchronously so it's ready before paint
          setPositions(runSim(data.nodes, data.edges));
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
  const hasEnough = totalCollisions >= 50 && (mapData?.nodes.length ?? 0) > 0;

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
  const nodes     = mapData!.nodes;
  const edges     = mapData!.edges;
  const maxCount  = Math.max(...nodes.map(n => n.count), 1);
  const maxWeight = Math.max(...edges.map(e => e.weight), 1);
  const graphH    = SH - 90; // leave room for top bar

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.screenTitle}>MAP</Text>
        <Text style={s.subtitle}>{nodes.length} DOMAINS · {totalCollisions} COLLISIONS</Text>
      </View>

      {/* Graph — PanResponder captures gestures here */}
      <View style={{flex: 1}} {...panResponder.panHandlers}>
        <Svg width={SW} height={graphH}>
          <G
            transform={`translate(${displayTf.x}, ${displayTf.y}) scale(${displayTf.scale})`}
          >
            {/* Edges */}
            {edges.map((edge, i) => {
              const sp = positions[edge.source];
              const tp = positions[edge.target];
              if (!sp || !tp) return null;
              const opacity = 0.08 + (edge.weight / maxWeight) * 0.35;
              return (
                <Line
                  key={`e-${i}`}
                  x1={sp.x} y1={sp.y}
                  x2={tp.x} y2={tp.y}
                  stroke="#333333"
                  strokeWidth={1}
                  opacity={opacity}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const pos  = positions[node.id];
              if (!pos) return null;
              const r         = nodeRadius(node.count, maxCount);
              const fill      = CATEGORY_FILL[node.category]  ?? '#888880';
              const textColor = CATEGORY_TEXT[node.category]  ?? '#ffffff';
              const isSelected = selected?.id === node.id;
              const label = node.domain.length > 13
                ? node.domain.slice(0, 12) + '…'
                : node.domain;
              return (
                <React.Fragment key={node.id}>
                  <Circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={fill}
                    stroke={isSelected ? '#ffffff' : 'transparent'}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                  <SvgText
                    x={pos.x}
                    y={pos.y + 3}
                    fontSize={8}
                    fontFamily="monospace"
                    fill={textColor}
                    textAnchor="middle"
                  >
                    {label}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </G>
        </Svg>

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
