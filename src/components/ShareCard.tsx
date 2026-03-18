/**
 * ShareCard
 *
 * A self-contained, image-ready card component designed to be captured
 * by react-native-view-shot. All dimensions are fixed — no flex that
 * depends on a parent. Renders off-screen at a fixed width of 375px.
 */
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

const CARD_WIDTH = 375;

// ── Collision card ──────────────────────────────────────────────────────────

interface ShareCollisionCardProps {
  domain: string;
  title: string;
  bridge: string;
  accentColor: string;
}

export function ShareCollisionCard({
  domain,
  title,
  bridge,
  accentColor,
}: ShareCollisionCardProps) {
  return (
    <View style={[s.wrapper, {width: CARD_WIDTH}]}>
      {/* 2px top accent bar */}
      <View style={[s.accentBar, {backgroundColor: accentColor}]} />

      <View style={s.body}>
        {/* Domain tag */}
        <View style={s.domainRow}>
          <View style={[s.domainDot, {backgroundColor: accentColor}]} />
          <Text style={s.domainText}>{domain.toUpperCase()}</Text>
        </View>

        {/* Title */}
        <Text style={s.title}>{title}</Text>

        {/* Divider */}
        <View style={s.divider} />

        {/* Bridge label */}
        <Text style={[s.bridgeLabel, {color: accentColor}]}>
          STRUCTURAL BRIDGE
        </Text>

        {/* Bridge text */}
        <Text style={s.bridgeText}>{bridge}</Text>

        {/* Branding */}
        <View style={s.brandingRow}>
          <Text style={s.branding}>conceptcollision.app</Text>
        </View>
      </View>
    </View>
  );
}

// ── Synthesis card ──────────────────────────────────────────────────────────

interface ShareSynthesisCardProps {
  structuralEssence: string;
  synthesis: string;
}

export function ShareSynthesisCard({
  structuralEssence,
  synthesis,
}: ShareSynthesisCardProps) {
  return (
    <View style={[s.wrapper, {width: CARD_WIDTH}]}>
      {/* 2px accent bar */}
      <View style={[s.accentBar, {backgroundColor: '#c8f064'}]} />

      <View style={s.body}>
        {/* Essence label + text */}
        <Text style={s.sectionLabel}>STRUCTURAL ESSENCE</Text>
        <Text style={s.essenceText}>{structuralEssence}</Text>

        <View style={s.divider} />

        {/* Synthesis label + text */}
        <Text style={s.sectionLabel}>SYNTHESIS</Text>
        <Text style={s.synthesisText}>{synthesis}</Text>

        {/* Branding */}
        <View style={s.brandingRow}>
          <Text style={s.branding}>conceptcollision.app</Text>
        </View>
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrapper: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#222222',
    overflow: 'hidden',
  },
  accentBar: {
    height: 2,
  },
  body: {
    padding: 20,
    paddingBottom: 16,
    backgroundColor: '#141414',
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  domainDot: {
    width: 8,
    height: 8,
    marginRight: 8,
  },
  domainText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#999990',
  },
  title: {
    fontFamily: 'serif',
    fontSize: 17,
    fontStyle: 'italic',
    color: '#e8e8e0',
    lineHeight: 26,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#222222',
    marginBottom: 14,
  },
  bridgeLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    marginBottom: 8,
  },
  bridgeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#999990',
    lineHeight: 20,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#888880',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  essenceText: {
    fontFamily: 'serif',
    fontSize: 15,
    fontStyle: 'italic',
    color: '#e8e8e0',
    lineHeight: 24,
    marginBottom: 16,
  },
  synthesisText: {
    fontFamily: 'serif',
    fontSize: 15,
    fontStyle: 'italic',
    color: '#e8e8e0',
    lineHeight: 24,
  },
  brandingRow: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  branding: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#555550',
    letterSpacing: 1,
  },
});
