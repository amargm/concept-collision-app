import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Share,
  StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {COLORS, CARD_COLORS} from '../utils/constants';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({navigation, route}: Props) {
  const {problem, result} = route.params;

  const handleShare = async () => {
    const text = [
      `PROBLEM: ${problem}`,
      '',
      `STRUCTURAL ESSENCE: ${result.structural_essence}`,
      '',
      `SYNTHESIS: ${result.synthesis}`,
    ].join('\n');

    await Share.share({message: text});
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare}>
          <Text style={styles.shareText}>SHARE ↗</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}>
        {/* Structural Essence */}
        <View style={styles.essenceBlock}>
          <Text style={styles.sectionLabel}>STRUCTURAL ESSENCE</Text>
          <Text style={styles.essenceText}>{result.structural_essence}</Text>
        </View>

        {/* Domain Collisions */}
        <Text style={[styles.sectionLabel, {marginTop: 28, marginBottom: 14}]}>
          DOMAIN COLLISIONS
        </Text>
        {result.collisions.map((collision, i) => (
          <View key={i} style={styles.card}>
            <View
              style={[styles.cardBar, {backgroundColor: CARD_COLORS[i]}]}
            />
            <View style={styles.cardContent}>
              <View style={styles.domainRow}>
                <View
                  style={[styles.domainDot, {backgroundColor: CARD_COLORS[i]}]}
                />
                <Text style={styles.domainName}>{collision.domain.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardTitle}>{collision.title}</Text>
              <Text style={styles.cardBody}>{collision.how_they_solved_it}</Text>
              <View style={styles.divider} />
              <Text style={styles.bridgeLabel}>STRUCTURAL BRIDGE</Text>
              <Text style={styles.bridgeText}>{collision.bridge}</Text>
            </View>
          </View>
        ))}

        {/* Synthesis */}
        <Text style={[styles.sectionLabel, {marginTop: 28, marginBottom: 14}]}>
          SYNTHESIS
        </Text>
        <View style={styles.synthesisCard}>
          <Text style={styles.synthesisTag}>SYNTHESIS</Text>
          <Text style={styles.synthesisText}>{result.synthesis}</Text>
        </View>

        {/* New collision button */}
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.popToTop()}>
          <Text style={styles.newBtnText}>NEW COLLISION →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.mutedLight,
  },
  shareText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.accent,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  essenceBlock: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    paddingLeft: 14,
    paddingVertical: 16,
    marginTop: 20,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: COLORS.muted,
    textTransform: 'uppercase',
  },
  essenceText: {
    fontFamily: 'serif',
    fontSize: 16,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 24,
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    marginBottom: 14,
    overflow: 'hidden',
  },
  cardBar: {
    height: 2,
  },
  cardContent: {
    padding: 16,
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  domainDot: {
    width: 8,
    height: 8,
    marginRight: 8,
  },
  domainName: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: COLORS.mutedLight,
  },
  cardTitle: {
    fontFamily: 'serif',
    fontSize: 17,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: 10,
  },
  cardBody: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  bridgeLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: COLORS.accent,
    marginBottom: 6,
  },
  bridgeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: COLORS.mutedLight,
    lineHeight: 20,
  },
  synthesisCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 16,
  },
  synthesisTag: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: COLORS.accent,
    marginBottom: 10,
  },
  synthesisText: {
    fontFamily: 'serif',
    fontSize: 15,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 24,
  },
  newBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  newBtnText: {
    fontFamily: 'monospace',
    fontSize: 13,
    letterSpacing: 3,
    color: COLORS.background,
    fontWeight: '700',
  },
});
