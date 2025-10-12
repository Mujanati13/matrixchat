import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PinStackParamList } from '@navigation/RootNavigator';

export type SeedPreviewScreenProps = NativeStackScreenProps<PinStackParamList, 'SeedPreview'> & {
  seedWords: string[];
  seedHash: string;
  onContinue: () => void;
};

const SeedPreviewScreen = ({ seedWords, seedHash, onContinue }: SeedPreviewScreenProps) => {
  console.log('!!! SeedPreviewScreen component rendering !!!', {
    wordsCount: seedWords?.length,
    firstWord: seedWords?.[0],
    hash: seedHash?.substring(0, 10)
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your recovery seed</Text>
      <Text style={styles.subtitle}>
        Write these words down in order. They allow you to recover your account if you forget your
        password.
      </Text>

      <FlatList
        data={seedWords}
        keyExtractor={(item, index) => `${item}-${index}`}
        numColumns={2}
        scrollEnabled={false}
        columnWrapperStyle={styles.row}
        renderItem={({ item, index }) => (
          <View style={styles.seedItem}>
            <Text style={styles.seedIndex}>{index + 1}.</Text>
            <Text style={styles.seedWord}>{item}</Text>
          </View>
        )}
        ListFooterComponent={() => (
          <View style={styles.hashContainer}>
            <Text style={styles.hashLabel}>Recovery hash</Text>
            <Text style={styles.hashValue}>{seedHash}</Text>
          </View>
        )}
      />

      <TouchableOpacity style={styles.button} onPress={onContinue}>
        <Text style={styles.buttonText}>I wrote it down</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#050b12',
  },
  title: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#a7afc2',
    marginBottom: 24,
    lineHeight: 20,
  },
  row: {
    justifyContent: 'space-between',
  },
  seedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101723',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
    width: '48%',
  },
  seedIndex: {
    color: '#4f5d78',
    fontWeight: '600',
    marginRight: 8,
  },
  seedWord: {
    color: '#ffffff',
    fontSize: 16,
    textTransform: 'lowercase',
  },
  hashContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#0c1420',
    borderRadius: 12,
  },
  hashLabel: {
    color: '#6a7a91',
    fontSize: 12,
    marginBottom: 4,
  },
  hashValue: {
    color: '#c9d4e3',
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    marginTop: 32,
    backgroundColor: '#0b5cff',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default SeedPreviewScreen;
