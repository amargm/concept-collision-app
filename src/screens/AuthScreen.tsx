import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../App';
import {useAuth} from '../hooks/useAuth';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

// ── Animated dots (dark on accent bg) ────────────────────────────────────────
function SigningInDots() {
  const dots = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, {toValue: 1, duration: 350, useNativeDriver: true}),
          Animated.timing(dot, {toValue: 0.3, duration: 350, useNativeDriver: true}),
          Animated.delay((2 - i) * 180),
        ]),
      ),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.dotsRow}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[styles.dot, {opacity: dot}]} />
      ))}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function AuthScreen({navigation}: Props) {
  const {signIn, user} = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If auth state resolves to signed-in (e.g. back from background), navigate
  useEffect(() => {
    if (user) {
      navigation.replace('Main');
    }
  }, [user, navigation]);

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      const success = await signIn();
      Alert.alert('DEBUG', `signIn() returned: ${success}`);
      if (success) {
        navigation.replace('Main');
      }
    } catch (e: any) {
      const msg: string = e?.message ?? 'Sign-in failed. Try again.';
      Alert.alert('DEBUG ERROR', msg);
      setError(msg.length > 120 ? msg.slice(0, 120) + '…' : msg);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* ── Centre block ── */}
      <View style={styles.centre}>
        {/* Logo */}
        <View style={styles.logoBlock}>
          <Text style={styles.logoLine}>
            <Text style={styles.logoRegular}>Concept </Text>
            <Text style={styles.logoAccent}>Collision</Text>
          </Text>
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>CROSS-DOMAIN PATTERN ENGINE</Text>

        {/* Gap */}
        <View style={styles.gap} />

        {/* Sign-in button */}
        <TouchableOpacity
          style={styles.btn}
          onPress={handleSignIn}
          disabled={signingIn}
          activeOpacity={0.85}>
          {signingIn ? (
            <SigningInDots />
          ) : (
            <Text style={styles.btnText}>CONTINUE WITH GOOGLE</Text>
          )}
        </TouchableOpacity>

        {/* Inline error */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL('https://concept-collision-api-wxxet2kdkq-el.a.run.app/privacy')
          }
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Text style={styles.footerLink}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  // ── Centre ──────────────────────────────────────────────────────────────────
  centre: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },

  // ── Logo ────────────────────────────────────────────────────────────────────
  logoBlock: {
    marginBottom: 12,
  },
  logoLine: {
    // parent Text — needed for mixed inline styles
  },
  logoRegular: {
    fontFamily: 'serif',
    fontSize: 32,
    color: '#e8e8e0',
  },
  logoAccent: {
    fontFamily: 'serif',
    fontSize: 32,
    fontStyle: 'italic',
    color: '#c8f064',
  },

  // ── Tagline ─────────────────────────────────────────────────────────────────
  tagline: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#888880',
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  // ── Gap ─────────────────────────────────────────────────────────────────────
  gap: {
    height: 48,
  },

  // ── Button ──────────────────────────────────────────────────────────────────
  btn: {
    backgroundColor: '#c8f064',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: '#0a0a0a',
  },

  // ── Loading dots (dark on accent) ───────────────────────────────────────────
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    backgroundColor: '#0a0a0a',
  },

  // ── Error ───────────────────────────────────────────────────────────────────
  errorText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#f06464',
    marginTop: 12,
    lineHeight: 18,
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  footerLink: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#555550',
  },
});
