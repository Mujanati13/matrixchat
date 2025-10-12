import React, { useCallback, useEffect, useState } from 'react';
import { 
  Alert, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { sha256 } from '@noble/hashes/sha256';

import { useMatrix } from '@contexts/MatrixContext';
import { storeRecoveryKey } from '@services/recoveryApi';

const SeedPhraseScreen = () => {
  const { session } = useMatrix();
  const [seedPhrase, setSeedPhrase] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Generate a new seed phrase when component mounts
    const mnemonic = generateMnemonic(wordlist, 128); // 12 words
    setSeedPhrase(mnemonic);
  }, []);

  const handleCopyToClipboard = useCallback(async () => {
    try {
      await Clipboard.setString(seedPhrase);
      Alert.alert('Copied', 'Seed phrase copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  }, [seedPhrase]);

  const handleSaveRecovery = useCallback(async () => {
    if (!session || !seedPhrase) {
      Alert.alert('Error', 'No session or seed phrase available');
      return;
    }

    console.log('Session available:', {
      hasAccessToken: !!session.accessToken,
      hasUserId: !!session.userId,
      userId: session.userId
    });

    setLoading(true);
    try {
      // Hash the seed phrase
      const recoveryKeyHash = Array.from(sha256(seedPhrase))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const sessionForApi = {
        access_token: session.accessToken,
        user_id: session.userId,
      };

      console.log('Calling storeRecoveryKey with session:', {
        hasAccessToken: !!sessionForApi.access_token,
        hasUserId: !!sessionForApi.user_id
      });

      // Store via recovery API with automatic fallback to account data
      await storeRecoveryKey({
        user_id: session.userId,
        recovery_key_hash: recoveryKeyHash,
      }, sessionForApi);

      Alert.alert(
        'Recovery Saved',
        'Your recovery seed phrase has been securely saved. Keep this phrase safe!',
      );
    } catch (error: any) {
      console.error('Failed to save recovery:', error);
      Alert.alert('Error', error?.message ?? 'Failed to save recovery key');
    } finally {
      setLoading(false);
    }
  }, [session, seedPhrase]);

  const seedWords = seedPhrase.split(' ');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your Recovery Seed Phrase</Text>
        <Text style={styles.subtitle}>
          Write down these 12 words in order. You'll need them to recover your account if you lose access.
        </Text>

        <View style={styles.seedContainer}>
          {seedWords.map((word, index) => (
            <View key={index} style={styles.wordContainer}>
              <Text style={styles.wordNumber}>{index + 1}</Text>
              <Text style={styles.word}>{word}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.copyButton} 
          onPress={handleCopyToClipboard}
        >
          <Text style={styles.copyButtonText}>Copy to Clipboard</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
          onPress={handleSaveRecovery}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Recovery Key</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.warning}>
          ⚠️ Keep this phrase secure and private. Anyone with access to it can recover your account.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050b12',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#8a94a8',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  seedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  wordContainer: {
    width: '30%',
    backgroundColor: '#101723',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordNumber: {
    fontSize: 12,
    color: '#6e7b92',
    marginRight: 8,
    minWidth: 20,
  },
  word: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  copyButton: {
    backgroundColor: '#4f5d73',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  copyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#0b5cff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#1f3d7a',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  warning: {
    fontSize: 14,
    color: '#ff8a80',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
});

export default SeedPhraseScreen;
