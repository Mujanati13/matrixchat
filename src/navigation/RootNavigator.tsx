import React, { useEffect, useMemo, useState } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useColorScheme, View } from 'react-native';

import LoadingView from '@components/LoadingView';
import { useMatrix } from '@contexts/MatrixContext';
import { useFlow } from '@contexts/FlowContext';
import { usePin } from '@contexts/PinContext';
import AboutScreen from '@screens/about/AboutScreen';
import LoginScreen from '@screens/auth/LoginScreen';
import SignupScreen from '@screens/auth/SignupScreen';
import RecoveryScreen from '@screens/auth/RecoveryScreen';
import RoomDetailScreen from '@screens/home/RoomDetailScreen';
import RoomListScreen from '@screens/home/RoomListScreen';
import PinScreen from '@screens/pin/PinScreen';
import SeedPreviewScreen from '@screens/pin/SeedPreviewScreen';
import ProfileScreen from '@screens/profile/ProfileScreen';
import SeedPhraseScreen from '@screens/profile/SeedPhraseScreen';
import SearchScreen from '@screens/search/SearchScreen';
import SettingsScreen from '@screens/settings/SettingsScreen';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  Recovery: undefined;
};

export type PinStackParamList = {
  SeedPreview: undefined;
  PinGate: undefined;
};

export type AppStackParamList = {
  Rooms: undefined;
  RoomDetail: { roomId: string; roomName?: string };
  Profile: { userId?: string } | undefined;
  SeedPhrase: { seedWords: string[]; seedHash: string };
  About: undefined;
  Search: undefined;
  Settings: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const PinStack = createNativeStackNavigator<PinStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const AuthStackScreens = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Signup" component={SignupScreen} />
    <AuthStack.Screen name="Recovery" component={RecoveryScreen} />
  </AuthStack.Navigator>
);

const PinStackScreens = ({
  mode,
  onSuccess,
  seedPayload,
  onSeedAcknowledged,
}: {
  mode: 'setup' | 'verify';
  onSuccess: () => void;
  seedPayload: { words: string[]; hash: string } | null;
  onSeedAcknowledged: () => void;
}) => {
  console.log('PinStackScreens rendered with:', {
    mode,
    hasSeedPayload: !!seedPayload,
    seedPayloadWords: seedPayload?.words.length
  });

  // Force navigator to remount when seedPayload presence changes
  const navigatorKey = seedPayload ? 'with-seed' : 'no-seed';
  
  console.log('=== PINSTACK NAVIGATOR KEY ===', navigatorKey);

  if (seedPayload) {
    console.log('=== RENDERING WITH SEED PREVIEW FIRST ===');
    console.log('SeedPayload data:', { words: seedPayload.words, hash: seedPayload.hash.substring(0, 10) });
    
    // Render the SeedPreview directly without navigation wrapper
    // This ensures the recovery screen shows immediately
    return (
      <View style={{ flex: 1 }}>
        <SeedPreviewScreen
          navigation={null as any}
          route={null as any}
          seedWords={seedPayload.words}
          seedHash={seedPayload.hash}
          onContinue={() => {
            console.log('=== USER ACKNOWLEDGED SEED, CLEARING PAYLOAD ===');
            onSeedAcknowledged();
          }}
        />
      </View>
    );
  }

  console.log('=== RENDERING WITHOUT SEED PREVIEW ===');
  return (
    <PinStack.Navigator
      key={navigatorKey}
      screenOptions={{ headerShown: false }}
      initialRouteName="PinGate"
    >
      <PinStack.Screen name="PinGate">
        {(props: NativeStackScreenProps<PinStackParamList, 'PinGate'>) => (
          <PinScreen {...props} mode={mode} onSuccess={onSuccess} />
        )}
      </PinStack.Screen>
    </PinStack.Navigator>
  );
};

const AppStackScreens = () => (
  <AppStack.Navigator>
    <AppStack.Screen name="Rooms" component={RoomListScreen} options={{ headerShown: false }} />
    <AppStack.Screen
      name="RoomDetail"
      component={RoomDetailScreen}
      options={({ route }: { route: RouteProp<AppStackParamList, 'RoomDetail'> }) => ({
        title: route.params?.roomName ?? 'Conversation',
      })}
    />
    <AppStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    <AppStack.Screen
      name="SeedPhrase"
      component={SeedPhraseScreen}
      options={{ title: 'Recovery Seed' }}
    />
    <AppStack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
    <AppStack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
    <AppStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
  </AppStack.Navigator>
);

const RootNavigator = () => {
  const colorScheme = useColorScheme();
  const { session, isReady } = useMatrix();
  const { ready: pinReady, hasPin } = usePin();
  const { seedPayload, setSeedPayload } = useFlow();
  const [pinUnlocked, setPinUnlocked] = useState(false);

  useEffect(() => {
    setPinUnlocked(false);
  }, [session?.userId]);

  const handlePinSuccess = useMemo(() => () => setPinUnlocked(true), []);

  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  console.log('RootNavigator state:', {
    isReady,
    pinReady,
    hasSession: !!session,
    pinUnlocked,
    hasSeedPayload: !!seedPayload,
    hasPin,
    userId: session?.userId
  });

  if (!isReady || !pinReady) {
    return <LoadingView />;
  }

  // Log when navigation decision changes
  if (session && !pinUnlocked) {
    console.log('=== SHOWING PIN STACK ===');
    console.log('Mode:', hasPin ? 'verify' : 'setup');
    console.log('Has seedPayload:', !!seedPayload);
    console.log('SeedPayload details:', seedPayload ? {
      wordsCount: seedPayload.words.length,
      firstWord: seedPayload.words[0],
      hash: seedPayload.hash.substring(0, 10)
    } : 'null');
  }

  return (
    <NavigationContainer theme={theme}>
      {!session && <AuthStackScreens />}
      {session && !pinUnlocked && (
        <PinStackScreens
          mode={hasPin ? 'verify' : 'setup'}
          onSuccess={handlePinSuccess}
          seedPayload={seedPayload}
          onSeedAcknowledged={() => {
            console.log('=== SEED ACKNOWLEDGED - CLEARING ===');
            setSeedPayload(null);
          }}
        />
      )}
      {session && pinUnlocked && <AppStackScreens />}
    </NavigationContainer>
  );
};

export default RootNavigator;
