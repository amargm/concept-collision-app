import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {useAuth} from './src/hooks/useAuth';
import {CollisionResult} from './src/hooks/useCollision';
import ErrorBoundary from './src/components/ErrorBoundary';

// ── Screens ───────────────────────────────────────────────────────────────────
import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ResultScreen from './src/screens/ResultScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CollisionMapScreen from './src/screens/CollisionMapScreen';

// ── ApiKey compat shim (HomeScreen still imports this until it's rewritten) ───
interface ApiKeyContextType {
  apiKey: string | null;
  saveKey: (key: string) => Promise<void>;
  clearKey: () => Promise<void>;
}
export const ApiKeyContext = createContext<ApiKeyContextType>({
  apiKey: null,
  saveKey: async () => {},
  clearKey: async () => {},
});
export const useApiKeyContext = () => useContext(ApiKeyContext);

// ── Stub screens (replace as each is built) ───────────────────────────────────
const stub = (label: string) => () => (
  <View style={{flex:1,backgroundColor:'#0a0a0a',alignItems:'center',justifyContent:'center'}}>
    <Text style={{color:'#555550',fontFamily:'monospace',fontSize:11,letterSpacing:3}}>
      {label.toUpperCase()}
    </Text>
  </View>
);
const DailyScreen            = stub('daily');
const PaywallScreen          = stub('paywall');
const CollectionDetailScreen = stub('collection detail');
const WorkspaceScreen        = stub('workspace');

// ── Navigator types ───────────────────────────────────────────────────────────
export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Main: undefined;
  Result: {problem: string; result: CollisionResult};
  Paywall: undefined;
  CollectionDetail: {collectionId: string; name: string};
};

type MainTabParamList = {
  Home: undefined;
  Daily: undefined;
  Workspace: undefined;
  Map: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const ONBOARDING_KEY = 'onboarding_complete';

// ── Animated loading dots ─────────────────────────────────────────────────────
function SplashScreen() {
  // Start at 0.4 so dots are visible immediately, then pulse to 1 and back
  const dots = [useRef(new Animated.Value(0.4)).current,
                useRef(new Animated.Value(0.4)).current,
                useRef(new Animated.Value(0.4)).current];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, {toValue: 1, duration: 400, useNativeDriver: true}),
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
    <View style={styles.splash}>
      <View style={styles.dotsRow}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, {opacity: dot}]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Bottom tab navigator ──────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#c8f064',
        tabBarInactiveTintColor: '#555550',
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}>
      <Tab.Screen name="Home"      component={HomeScreen} />
      <Tab.Screen name="Daily"     component={DailyScreen} />
      <Tab.Screen
        name="Workspace"
        component={WorkspaceScreen}
        options={{
          tabBarActiveTintColor: '#64c8f0',
          tabBarLabel: 'WORKSPACE',
        }}
      />
      <Tab.Screen name="Map"       component={CollisionMapScreen} />
      <Tab.Screen name="Settings"  component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const {user, loading} = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setOnboardingDone(val === 'true');
      setOnboardingChecked(true);
    });
  }, []);

  // Show dots until both Firebase auth state and AsyncStorage are resolved
  if (loading || !onboardingChecked) {
    return <SplashScreen />;
  }

  const initialRoute: keyof RootStackParamList = user
    ? 'Main'
    : onboardingDone
      ? 'Auth'
      : 'Onboarding';

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerShown: false,
              contentStyle: {backgroundColor: '#0a0a0a'},
              animation: 'slide_from_right',
            }}>
            {/* Auth flow */}
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Auth"       component={AuthScreen} />

            {/* Authenticated — bottom tabs */}
            <Stack.Screen name="Main" component={MainTabs} />

            {/* Pushed from Home / History */}
            <Stack.Screen
              name="Result"
              component={ResultScreen}
              options={{animation: 'slide_from_right'}}
            />

            {/* Modals */}
            <Stack.Screen
              name="Paywall"
              component={PaywallScreen}
              options={{presentation: 'modal', animation: 'slide_from_bottom'}}
            />
            <Stack.Screen
              name="CollectionDetail"
              component={CollectionDetailScreen}
              options={{presentation: 'modal', animation: 'slide_from_bottom'}}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    backgroundColor: '#c8f064',
  },
  tabBar: {
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    elevation: 0,
    shadowOpacity: 0,
    height: 56,
    paddingBottom: 8,
  },
  tabLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
