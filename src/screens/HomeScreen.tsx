import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {COLORS, EXAMPLE_CHIPS} from '../utils/constants';
import {useCollision} from '../hooks/useCollision';
import {useHistory} from '../hooks/useHistory';
import {useApiKeyContext} from '../../App';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({navigation}: Props) {
  const [problem, setProblem] = useState('');
  const [focused, setFocused] = useState(false);
  const {collide, loading, error} = useCollision();
  const {add} = useHistory();
  const {apiKey} = useApiKeyContext();
  const inputRef = useRef<TextInput>(null);

  const handleCollide = async () => {
    if (!problem.trim() || !apiKey) return;
    const result = await collide(problem.trim(), apiKey);
    if (result) {
      await add(problem.trim(), result);
      navigation.navigate('Result', {problem: problem.trim(), result});
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>
              Concept{' '}
              <Text style={styles.headerAccent}>Collision</Text>
            </Text>
            <Text style={styles.tagline}>CROSS-DOMAIN PATTERN ENGINE</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.navigate('History')}>
              <Text style={styles.headerBtnText}>HISTORY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.navigate('ApiKey')}>
              <Text style={styles.headerBtnText}>⚙ KEY</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Input */}
        <Text style={styles.label}>DESCRIBE YOUR PROBLEM</Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, focused && styles.inputFocused]}
          value={problem}
          onChangeText={setProblem}
          placeholder="Type your problem or challenge..."
          placeholderTextColor={COLORS.muted}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {/* Collide button */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={COLORS.accent} size="small" />
            <Text style={styles.loadingText}>SCANNING DOMAINS...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.collideBtn,
              (!problem.trim() || !apiKey) && styles.collideBtnDisabled,
            ]}
            onPress={handleCollide}
            disabled={!problem.trim() || !apiKey}>
            <Text style={styles.collideBtnText}>COLLIDE →</Text>
          </TouchableOpacity>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Example chips */}
        <Text style={[styles.label, {marginTop: 30}]}>EXAMPLES</Text>
        {EXAMPLE_CHIPS.map((chip, i) => (
          <TouchableOpacity
            key={i}
            style={styles.chip}
            onPress={() => {
              setProblem(chip);
              inputRef.current?.focus();
            }}>
            <Text style={styles.chipText}>{chip}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 20,
    marginBottom: 30,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'serif',
    fontSize: 24,
    color: COLORS.text,
  },
  headerAccent: {
    fontFamily: 'serif',
    fontStyle: 'italic',
    color: COLORS.accent,
  },
  tagline: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: COLORS.muted,
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerBtnText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.mutedLight,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: COLORS.muted,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    fontFamily: 'monospace',
    fontSize: 13,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 140,
    lineHeight: 20,
    marginBottom: 16,
  },
  inputFocused: {
    borderColor: COLORS.accent,
  },
  collideBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    alignItems: 'center',
  },
  collideBtnDisabled: {
    opacity: 0.4,
  },
  collideBtnText: {
    fontFamily: 'monospace',
    fontSize: 13,
    letterSpacing: 3,
    color: COLORS.background,
    fontWeight: '700',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  loadingText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.accent,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: COLORS.accentRed,
    marginTop: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  chipText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: COLORS.mutedLight,
    lineHeight: 18,
  },
});
