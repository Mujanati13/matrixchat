import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const LoadingView = () => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color="#0f62fe" />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
});

export default LoadingView;
