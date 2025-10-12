import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { MatrixProvider } from '@contexts/MatrixContext';
import { FlowProvider } from '@contexts/FlowContext';
import { PinProvider } from '@contexts/PinContext';
import RootNavigator from '@navigation/RootNavigator';

const App = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <MatrixProvider>
      <FlowProvider>
        <PinProvider>
          <RootNavigator />
        </PinProvider>
      </FlowProvider>
    </MatrixProvider>
  </GestureHandlerRootView>
);

export default App;
