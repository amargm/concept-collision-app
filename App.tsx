import React, {createContext, useContext, useEffect, useState} from 'react';
import {ActivityIndicator, View, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {useApiKey} from './src/hooks/useApiKey';
import {CollisionResult} from './src/hooks/useCollision';
import ApiKeyScreen from './src/screens/ApiKeyScreen';
import HomeScreen from './src/screens/HomeScreen';
import ResultScreen from './src/screens/ResultScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import {COLORS} from './src/utils/constants';

export type RootStackParamList = {
  ApiKey: undefined;
  Home: undefined;
  Result: {problem: string; result: CollisionResult};
  History: undefined;
};

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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const {apiKey, loading, saveKey, clearKey} = useApiKey();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      setReady(true);
    }
  }, [loading]);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <ApiKeyContext.Provider value={{apiKey, saveKey, clearKey}}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: {backgroundColor: COLORS.background},
              animation: 'slide_from_right',
            }}
            initialRouteName={apiKey ? 'Home' : 'ApiKey'}>
            <Stack.Screen name="ApiKey" component={ApiKeyScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Result" component={ResultScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ApiKeyContext.Provider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
