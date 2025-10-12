import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootApp from './src/App';

const App = () => (
  <SafeAreaProvider>
    <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
    <RootApp />
  </SafeAreaProvider>
);

export default App;
