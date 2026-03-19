/**
 * ThreadCollisionCard — single collision domain card rendered inline in the
 * problem thread. Collapsed by default; tap to expand full body + bridge.
 * Long press toggles key-insight mark.
 */
import React from 'react';
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ── Card accent colors by card index ──────────────────────────────────────────
const CARD_ACCENT: string[] = ['#c8f064', '#f06464', '#64c8f0', '#c064f0'];

// ── Category detection (mirrors ProblemDetailScreen) ─────────────────────────
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
    if (new RegExp(pattern, 'i').test(lower)) {return cat;}
  }
  return 'Other';
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface ThreadCollisionCardProps {
  card: {
    domain:           string;
    title:            string;
    how_they_solved_it: string;
    bridge:           string;
  };
  cardIndex:          number;
  isKeyInsight:       boolean;
  expanded:           boolean;
  onToggleExpand:     () => void;
  onMarkKeyInsight:   () => void;
  onRemoveKeyInsight: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ThreadCollisionCard({
  card,
  cardIndex,
  isKeyInsight,
  expanded,
  onToggleExpand,
  onMarkKeyInsight,
  onRemoveKeyInsight,
}: ThreadCollisionCardProps) {
  const accentColor = CARD_ACCENT[cardIndex] ?? '#c8f064';
  const catColor    = CATEGORY_COLORS[domainCategory(card.domain)] ?? '#888880';

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggleExpand();
  };

  const handleLongPress = () => {
    if (isKeyInsight) {
      onRemoveKeyInsight();
    } else {
      onMarkKeyInsight();
    }
  };

  return (
    <TouchableOpacity
      onPress={toggle}
      onLongPress={handleLongPress}
      activeOpacity={0.85}
      style={c.card}>

      {/* 2px top accent bar */}
      <View style={[c.bar, {backgroundColor: accentColor}]} />

      <View style={c.inner}>

        {/* Domain row: dot · domain name · (star badge) */}
        <View style={c.domainRow}>
          <View style={[c.dot, {backgroundColor: catColor}]} />
          <Text style={[c.domainText, {color: catColor}]} numberOfLines={1}>
            {card.domain.toUpperCase()}
          </Text>
          <View style={c.spacer} />
          {isKeyInsight && <Text style={c.starBadge}>★</Text>}
        </View>

        {/* Title */}
        <Text style={[c.title, expanded && c.titleExpanded]}>
          {card.title}
        </Text>

        {/* Expanded body + bridge */}
        {expanded && (
          <>
            <Text style={c.body}>{card.how_they_solved_it}</Text>
            <View style={c.divider} />
            <Text style={c.bridgeLabel}>STRUCTURAL BRIDGE</Text>
            <Text style={c.bridgeText}>{card.bridge}</Text>
          </>
        )}

        {/* Bottom indicator row */}
        {expanded ? (
          <View style={c.bottomExpanded}>
            <View style={c.keyInsightRow}>
              {isKeyInsight ? (
                <>
                  <Text style={c.keyInsightActive}>★ KEY INSIGHT</Text>
                  <TouchableOpacity
                    onPress={onRemoveKeyInsight}
                    style={c.removeBtn}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                    <Text style={c.removeLabel}>REMOVE</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={onMarkKeyInsight}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Text style={c.markLabel}>MARK AS KEY INSIGHT</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={c.indicator}>▲</Text>
          </View>
        ) : (
          <View style={c.bottomCollapsed}>
            <Text style={c.indicator}>▶</Text>
          </View>
        )}

      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const c = StyleSheet.create({
  card: {
    backgroundColor: '#141414',
    borderWidth:     1,
    borderColor:     '#222222',
    marginBottom:    6,
    overflow:        'hidden',
  },
  bar: {
    height: 2,
    width:  '100%',
  },
  inner: {
    paddingHorizontal: 16,
    paddingVertical:   12,
  },

  // Domain row
  domainRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  8,
  },
  dot: {
    width:       6,
    height:      6,
    marginRight: 8,
  },
  domainText: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 2,
    flexShrink:    1,
  },
  spacer: {flex: 1},
  starBadge: {
    fontFamily: 'monospace',
    fontSize:   13,
    color:      '#c8f064',
    marginLeft: 6,
  },

  // Title
  title: {
    fontFamily:   'serif',
    fontStyle:    'italic',
    fontSize:     15,
    color:        '#e8e8e0',
    lineHeight:   22,
    marginBottom: 4,
  },
  titleExpanded: {
    fontSize:     17,
    lineHeight:   24,
    marginBottom: 12,
  },

  // Expanded content
  body: {
    fontFamily:   'monospace',
    fontSize:     11,
    color:        '#999990',
    lineHeight:   19.8,
    marginBottom: 12,
  },
  divider: {
    height:        1,
    backgroundColor: '#222222',
    marginBottom:  10,
  },
  bridgeLabel: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 3,
    color:         '#c8f064',
    textTransform: 'uppercase',
    marginBottom:  6,
  },
  bridgeText: {
    fontFamily:   'monospace',
    fontSize:     11,
    color:        '#555550',
    lineHeight:   17,
    marginBottom: 12,
  },

  // Bottom rows
  bottomCollapsed: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    marginTop:      4,
  },
  bottomExpanded: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      8,
  },
  keyInsightRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  keyInsightActive: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1.5,
    color:         '#c8f064',
  },
  removeBtn: {
    marginLeft: 12,
  },
  removeLabel: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1.5,
    color:         '#555550',
  },
  markLabel: {
    fontFamily:    'monospace',
    fontSize:      9,
    letterSpacing: 1.5,
    color:         '#555550',
  },
  indicator: {
    fontFamily: 'monospace',
    fontSize:   9,
    color:      '#555550',
  },
});
