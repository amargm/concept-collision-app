import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {COLORS, EXAMPLE_CHIPS} from '../utils/constants';
import {useCollision} from '../hooks/useCollision';
import {auth, firestore} from '../services/firebase';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList, MainTabParamList} from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// 3 animated dots + label
function LoadingDots() {
  const dots = [useRef(new Animated.Value(0.4)).current,
                useRef(new Animated.Value(0.4)).current,
                useRef(new Animated.Value(0.4)).current];
  React.useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 180),
        Animated.timing(d, {toValue: 1, duration: 350, useNativeDriver: true}),
        Animated.timing(d, {toValue: 0.4, duration: 350, useNativeDriver: true}),
        Animated.delay((2 - i) * 180),
      ])),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={loadingStyles.row}>
      <View style={loadingStyles.dotsInner}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[loadingStyles.dot, {opacity: d}]} />
        ))}
      </View>
      <Text style={loadingStyles.label}>SCANNING DOMAINS...</Text>
    </View>
  );
}
const loadingStyles = StyleSheet.create({
  row: {alignItems: 'center', paddingVertical: 18},
  dotsInner: {flexDirection: 'row', gap: 8, marginBottom: 10},
  dot: {width: 8, height: 8, backgroundColor: '#c8f064'},
  label: {fontFamily: 'monospace', fontSize: 9, letterSpacing: 3, color: '#c8f064'},
});

export default function HomeScreen({navigation}: Props) {
  const route = useRoute<RouteProp<MainTabParamList, 'Home'>>();

  const [problem, setProblem] = useState('');
  const [focused, setFocused] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [workspaceSaved, setWorkspaceSaved] = useState(false);
  const saveConfirmOpacity = useRef(new Animated.Value(0)).current;
  const {collide, loading, error, limitExceeded} = useCollision();
  const inputRef = useRef<TextInput>(null);

  // Pre-fill problem text when navigated from ProblemDetailScreen via "COLLIDE AGAIN"
  useEffect(() => {
    const prefill = route.params?.prefillProblem;
    if (prefill) {
      setProblem(prefill);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  // Only run when prefillProblem param changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.prefillProblem]);

  const handleCollide = async () => {
    if (!problem.trim()) return;
    const res = await collide(problem.trim(), 'core');
    if (res) {
      navigation.navigate('Result', {problem: problem.trim(), result: res.result, collisionId: res.id});
    }
  };

  const handleSaveToWorkspace = async () => {
    const trimmed = problem.trim();
    if (!trimmed || savingWorkspace) return;
    const user = auth().currentUser;
    if (!user) return;
    setSavingWorkspace(true);
    try {
      await firestore()
        .collection('problems')
        .doc(user.uid)
        .collection('items')
        .add({
          problem: trimmed,
          stage: 'waiting',
          source: 'queued',
          collisionCount: 0,
          collisionIds: [],
          domains: [],
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      setProblem('');
      // Fade in confirmation then fade out
      Animated.sequence([
        Animated.timing(saveConfirmOpacity, {toValue: 1, duration: 200, useNativeDriver: true}),
        Animated.delay(1500),
        Animated.timing(saveConfirmOpacity, {toValue: 0, duration: 300, useNativeDriver: true}),
      ]).start(() => setWorkspaceSaved(false));
      setWorkspaceSaved(true);
    } catch {
      // silently ignore
    } finally {
      setSavingWorkspace(false);
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
          <LoadingDots />
        ) : (
          <TouchableOpacity
            style={[
              styles.collideBtn,
              !problem.trim() && styles.collideBtnDisabled,
            ]}
            onPress={handleCollide}
            disabled={!problem.trim()}>
            <Text style={styles.collideBtnText}>COLLIDE →</Text>
          </TouchableOpacity>
        )}

        {/* Save to Workspace */}
        {!loading && problem.trim().length > 0 && (
          <TouchableOpacity
            onPress={handleSaveToWorkspace}
            disabled={savingWorkspace}
            style={styles.saveWorkspaceBtn}>
            <Text style={styles.saveWorkspaceBtnText}>SAVE TO WORKSPACE</Text>
          </TouchableOpacity>
        )}
        <Animated.Text
          style={[styles.saveConfirmText, {opacity: saveConfirmOpacity}]}
          pointerEvents="none">
          SAVED TO WORKSPACE
        </Animated.Text>

        {limitExceeded ? (
          <Text style={styles.errorText}>
            Monthly limit reached. Upgrade to continue.
          </Text>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

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
    color: COLORS.mutedLight,
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
  saveWorkspaceBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  saveWorkspaceBtnText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#64c8f0',
    textTransform: 'uppercase',
  },
  saveConfirmText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#64c8f0',
    textAlign: 'center',
    marginTop: 4,
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
