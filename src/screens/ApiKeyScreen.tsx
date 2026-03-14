import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {COLORS} from '../utils/constants';
import {useApiKeyContext} from '../../App';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ApiKey'>;

export default function ApiKeyScreen({navigation}: Props) {
  const [key, setKey] = useState('');
  const [masked, setMasked] = useState(true);
  const {saveKey} = useApiKeyContext();

  const handleSave = async () => {
    if (key.trim().length > 0) {
      await saveKey(key.trim());
      navigation.reset({index: 0, routes: [{name: 'Home'}]});
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.inner}>
        <Text style={styles.title}>API Key</Text>
        <Text style={styles.subtitle}>
          Paste your Gemini API key to get started
        </Text>

        <Text style={styles.label}>GEMINI API KEY</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={key}
            onChangeText={setKey}
            placeholder="Paste key here..."
            placeholderTextColor={COLORS.muted}
            secureTextEntry={masked}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setMasked(!masked)}>
            <Text style={styles.toggleText}>{masked ? 'SHOW' : 'HIDE'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            key.trim().length === 0 && styles.saveBtnDisabled,
          ]}
          onPress={handleSave}
          disabled={key.trim().length === 0}>
          <Text style={styles.saveBtnText}>SAVE & CONTINUE →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            Linking.openURL('https://aistudio.google.com/app/apikey')
          }>
          <Text style={styles.link}>Get a Gemini API key →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  title: {
    fontFamily: 'serif',
    fontSize: 28,
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: COLORS.mutedLight,
    marginBottom: 40,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: COLORS.muted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 13,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  toggleBtn: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  toggleText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.mutedLight,
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.background,
    fontWeight: '700',
  },
  link: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: COLORS.accentBlue,
    textDecorationLine: 'underline',
  },
});
