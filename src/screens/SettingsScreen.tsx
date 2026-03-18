import React, {useEffect, useState} from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {firestore} from '../services/firebase';
import {useAuth} from '../hooks/useAuth';
import type {RootStackParamList} from '../../App';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const APP_VERSION: string = require('../../package.json').version;

const FREE_LIMIT = 10;
const NOTIF_TOGGLE_KEY = 'daily_collision_enabled';
const NOTIF_TIME_KEY = 'daily_collision_time';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ── Section label with right-extending line ───────────────────────────────────
function SectionLabel({label}: {label: string}) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionText}>{label}</Text>
      <View style={s.sectionLine} />
    </View>
  );
}

// ── Time adjuster row ─────────────────────────────────────────────────────────
function TimeUnit({
  value,
  onInc,
  onDec,
}: {
  value: string;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <View style={s.timeUnit}>
      <TouchableOpacity style={s.timeBtn} onPress={onInc}>
        <Text style={s.timeBtnText}>+</Text>
      </TouchableOpacity>
      <Text style={s.timeValue}>{value}</Text>
      <TouchableOpacity style={s.timeBtn} onPress={onDec}>
        <Text style={s.timeBtnText}>-</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const {user, signOut} = useAuth();

  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const [collisionCount, setCollisionCount] = useState(0);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifHour, setNotifHour] = useState(9);
  const [notifMinute, setNotifMinute] = useState(0);

  useEffect(() => {
    if (!user) {return;}

    const unsub = firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(snap => {
        const data = snap.data() ?? {};
        setPlan(data.plan === 'pro' ? 'pro' : 'free');
        setCollisionCount(data.collisionCount ?? 0);
      });

    AsyncStorage.getItem(NOTIF_TOGGLE_KEY).then(v => {
      setNotifEnabled(v === 'true');
    });
    AsyncStorage.getItem(NOTIF_TIME_KEY).then(v => {
      if (v) {
        const [h, m] = v.split(':').map(Number);
        if (!isNaN(h)) {setNotifHour(h);}
        if (!isNaN(m)) {setNotifMinute(m);}
      }
    });

    return unsub;
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.reset({
      index: 0,
      routes: [{name: 'Auth'}],
    });
  };

  const handleNotifToggle = (val: boolean) => {
    setNotifEnabled(val);
    AsyncStorage.setItem(NOTIF_TOGGLE_KEY, String(val));
  };

  const adjustHour = (delta: number) => {
    const h = (notifHour + delta + 24) % 24;
    setNotifHour(h);
    AsyncStorage.setItem(NOTIF_TIME_KEY, `${h}:${notifMinute}`);
  };

  const adjustMinute = (delta: number) => {
    const m = (notifMinute + delta + 60) % 60;
    setNotifMinute(m);
    AsyncStorage.setItem(NOTIF_TIME_KEY, `${notifHour}:${m}`);
  };

  const pad = (n: number) => String(n).padStart(2, '0');
  const progress = Math.min((collisionCount / FREE_LIMIT) * 100, 100);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}>

        {/* ── ACCOUNT ────────────────────────────────────────────────────── */}
        <SectionLabel label="ACCOUNT" />

        <Text style={s.displayName}>{user?.displayName ?? '—'}</Text>
        <Text style={s.email}>{user?.email ?? '—'}</Text>

        <View style={s.divider} />

        <TouchableOpacity onPress={handleSignOut} style={s.row}>
          <Text style={s.signOutText}>SIGN OUT</Text>
        </TouchableOpacity>

        {/* ── PLAN ───────────────────────────────────────────────────────── */}
        <SectionLabel label="PLAN" />

        {plan === 'pro' ? (
          <View style={s.row}>
            <View style={s.proTag}>
              <Text style={s.proTagText}>PRO</Text>
            </View>
          </View>
        ) : (
          <View>
            <View style={s.row}>
              <Text style={s.planLabel}>FREE PLAN</Text>
            </View>
            <View style={s.divider} />
            <View style={s.planUsageRow}>
              <Text style={s.planUsageText}>
                {collisionCount} OF {FREE_LIMIT} COLLISIONS USED THIS MONTH
              </Text>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, {width: `${progress}%`}]} />
            </View>
            <View style={s.divider} />
            <TouchableOpacity style={s.upgradeBtn} onPress={() => {}}>
              <Text style={s.upgradeBtnText}>UPGRADE TO PRO</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── NOTIFICATIONS ──────────────────────────────────────────────── */}
        <SectionLabel label="NOTIFICATIONS" />

        <View style={s.rowBetween}>
          <Text style={s.rowLabel}>DAILY COLLISION</Text>
          <Switch
            value={notifEnabled}
            onValueChange={handleNotifToggle}
            trackColor={{false: '#222222', true: '#c8f064'}}
            thumbColor={'#e8e8e0'}
          />
        </View>

        {notifEnabled && (
          <>
            <View style={s.divider} />
            <View style={s.timePickerRow}>
              <Text style={s.rowLabelMuted}>TIME</Text>
              <View style={s.timeControls}>
                <TimeUnit
                  value={pad(notifHour)}
                  onInc={() => adjustHour(1)}
                  onDec={() => adjustHour(-1)}
                />
                <Text style={s.timeSep}>:</Text>
                <TimeUnit
                  value={pad(notifMinute)}
                  onInc={() => adjustMinute(15)}
                  onDec={() => adjustMinute(-15)}
                />
              </View>
            </View>
          </>
        )}

        {/* ── APP ────────────────────────────────────────────────────────── */}
        <SectionLabel label="APP" />

        <TouchableOpacity
          style={s.row}
          onPress={() => Linking.openURL('https://conceptcollision.app/privacy')}>
          <Text style={s.rowLabel}>PRIVACY POLICY</Text>
        </TouchableOpacity>

        <View style={s.divider} />

        <TouchableOpacity
          style={s.row}
          onPress={() =>
            Linking.openURL(
              'market://details?id=com.conceptcollision',
            )
          }>
          <Text style={s.rowLabel}>RATE THE APP</Text>
        </TouchableOpacity>

        <View style={s.divider} />

        <View style={s.rowBetween}>
          <Text style={s.rowLabelMuted}>VERSION</Text>
          <Text style={s.versionText}>{APP_VERSION}</Text>
        </View>

        <View style={s.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  // Section label
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  sectionText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 3,
    color: '#888880',
    textTransform: 'uppercase',
    marginRight: 12,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#222222',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#222222',
  },

  // Row patterns
  row: {
    paddingVertical: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    color: '#e8e8e0',
    textTransform: 'uppercase',
  },
  rowLabelMuted: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    color: '#888880',
    textTransform: 'uppercase',
  },

  // Account
  displayName: {
    fontFamily: 'serif',
    fontSize: 16,
    color: '#e8e8e0',
    marginBottom: 4,
  },
  email: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#555550',
    marginBottom: 12,
  },
  signOutText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    color: '#f06464',
    textTransform: 'uppercase',
  },

  // Plan
  planLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    color: '#e8e8e0',
    textTransform: 'uppercase',
  },
  planUsageRow: {
    paddingVertical: 12,
  },
  planUsageText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: '#888880',
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#222222',
    marginBottom: 16,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#c8f064',
  },
  upgradeBtn: {
    backgroundColor: '#c8f064',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 4,
  },
  upgradeBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: '#0a0a0a',
    textTransform: 'uppercase',
  },
  proTag: {
    backgroundColor: '#c8f064',
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  proTagText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: '#0a0a0a',
    textTransform: 'uppercase',
  },

  // Time picker
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeUnit: {
    alignItems: 'center',
    gap: 2,
  },
  timeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#222222',
  },
  timeBtnText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#c8f064',
  },
  timeValue: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: '#e8e8e0',
    letterSpacing: 2,
    paddingVertical: 4,
  },
  timeSep: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: '#555550',
    marginBottom: 2,
  },

  // App section
  versionText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#555550',
    letterSpacing: 2,
  },

  bottomSpacer: {
    height: 40,
  },
});
