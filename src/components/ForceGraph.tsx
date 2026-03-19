/**
 * ForceGraph — reusable force-directed graph rendered with react-native-svg.
 * Handles pan + pinch-zoom via PanResponder and hit-tests node taps.
 * Used by CollisionMapScreen (domain atlas) and WorkspaceScreen (problem map).
 */
import React, {useMemo, useRef, useState} from 'react';
import {PanResponder, View} from 'react-native';
import Svg, {Circle, G, Line, Text as SvgText} from 'react-native-svg';

const CANVAS = 900; // virtual coordinate space

// ── Public types ──────────────────────────────────────────────────────────────
export interface FGNode {
  id:         string;
  label:      string;
  color:      string;   // fill colour
  textColor?: string;   // label text; defaults to '#ffffff'
  size:       number;   // radius in virtual (CANVAS) coordinates
  data?:      any;      // opaque payload returned in onNodeTap
}

export interface FGEdge {
  source: string;
  target: string;
  weight: number;
  color?:  string;  // optional override; defaults to '#333333'
}

interface Props {
  nodes:       FGNode[];
  edges:       FGEdge[];
  onNodeTap:   (node: FGNode) => void;
  onEmptyTap?: () => void;
  width:       number;
  height:      number;
  selectedId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function touchDist(touches: {pageX: number; pageY: number}[]): number {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Force simulation (runs synchronously; pure function) ──────────────────────
function runSim(
  nodes: FGNode[],
  edges: FGEdge[],
): Record<string, {x: number; y: number}> {
  const N = nodes.length;
  if (N === 0) {return {};}

  const REPULSION  = 18000;
  const SPRING_LEN = 180;
  const SPRING_K   = 0.04;
  const CENTER_K   = 0.006;
  const DAMPING    = 0.72;

  // Start on a circle to avoid degenerate overlap
  const pos = nodes.map((_, i) => {
    const angle = (2 * Math.PI * i) / N;
    return {
      x:  CANVAS / 2 + Math.cos(angle) * 220,
      y:  CANVAS / 2 + Math.sin(angle) * 220,
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
        const nx = dx / d;
        const ny = dy / d;
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
      const nx = dx / d;
      const ny = dy / d;
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function ForceGraph({
  nodes,
  edges,
  onNodeTap,
  onEmptyTap,
  width,
  height,
  selectedId,
}: Props) {
  // Recompute layout only when the set of nodes / edges changes
  const nodeKey = nodes.map(n => n.id).join('\x00');
  const edgeKey = edges.map(e => `${e.source}>${e.target}`).join('\x00');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const positions = useMemo(() => runSim(nodes, edges), [nodeKey, edgeKey]);

  // Pan / zoom state — needs to trigger re-renders
  const [displayTf, setDisplayTf] = useState({x: 0, y: 0, scale: 1});

  // Gesture refs (stable across renders)
  const offsetX    = useRef(0);
  const offsetY    = useRef(0);
  const scaleVal   = useRef(1);
  const startX     = useRef(0);
  const startY     = useRef(0);
  const startScale = useRef(1);
  const lastDist   = useRef<number | null>(null);
  const didMove    = useRef(false);

  // Keep tap handler in a ref so the PanResponder closure always reads fresh props
  const handleTapRef = useRef<(sx: number, sy: number) => void>(() => {});
  handleTapRef.current = (svgX: number, svgY: number) => {
    if (Object.keys(positions).length === 0) {return;}
    for (const node of nodes) {
      const pos = positions[node.id];
      if (!pos) {continue;}
      const dx = svgX - pos.x;
      const dy = svgY - pos.y;
      if (dx * dx + dy * dy <= node.size * node.size) {
        onNodeTap(node);
        return;
      }
    }
    onEmptyTap?.();
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
          if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) {didMove.current = true;}
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

  const maxWeight = Math.max(...edges.map(e => e.weight), 1);

  return (
    <View style={{width, height}} {...panResponder.panHandlers}>
      <Svg width={width} height={height}>
        <G
          transform={`translate(${displayTf.x}, ${displayTf.y}) scale(${displayTf.scale})`}
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const sp = positions[edge.source];
            const tp = positions[edge.target];
            if (!sp || !tp) {return null;}
            const opacity = 0.08 + (edge.weight / maxWeight) * 0.35;
            return (
              <Line
                key={`e-${i}`}
                x1={sp.x} y1={sp.y}
                x2={tp.x} y2={tp.y}
                stroke={edge.color ?? '#333333'}
                strokeWidth={1}
                opacity={opacity}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const pos = positions[node.id];
            if (!pos) {return null;}
            const isSelected = selectedId === node.id;
            const label = node.label.length > 13
              ? node.label.slice(0, 12) + '…'
              : node.label;
            return (
              <React.Fragment key={node.id}>
                <Circle
                  cx={pos.x}
                  cy={pos.y}
                  r={node.size}
                  fill={node.color}
                  stroke={isSelected ? '#ffffff' : 'transparent'}
                  strokeWidth={isSelected ? 2 : 0}
                />
                <SvgText
                  x={pos.x}
                  y={pos.y + 3}
                  fontSize={8}
                  fontFamily="monospace"
                  fill={node.textColor ?? '#ffffff'}
                  textAnchor="middle"
                >
                  {label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
