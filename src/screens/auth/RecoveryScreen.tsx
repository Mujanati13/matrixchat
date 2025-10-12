import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { verifyRecoveryKey, resetPasswordAdmin } from '@services/recoveryApi';
import { ensureMatrixId } from '@utils/matrixId';
import { sha256Hex } from '@utils/hash';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@navigation/RootNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Recovery'>;

const RecoveryScreen = ({ navigation }: Props) => {
  const [seedPhrase, setSeedPhrase] = useState('');
  const [userId, setUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const cleanedSeedPhrase = useMemo(
    () =>
      seedPhrase
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .join(' '),
    [seedPhrase],
  );

  const handleRecover = useCallback(async () => {
    if (!cleanedSeedPhrase) {
      Alert.alert('Error', 'Please enter your recovery seed phrase');
      return;
    }

    if (!userId.trim()) {
      Alert.alert('Error', 'Please enter your user ID');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    const normalizedUserId = ensureMatrixId(userId.trim());
    const normalizedSeedPhrase = cleanedSeedPhrase.toLowerCase();
    const seedWords = normalizedSeedPhrase.split(' ').filter(Boolean);

    if (seedWords.length !== 12) {
      Alert.alert('Error', 'Your recovery phrase must contain exactly 12 words.');
      return;
    }

    const recoveryKeyHash = sha256Hex(normalizedSeedPhrase);

    setLoading(true);
    try {
      // Verify the recovery key
      const isValid = await verifyRecoveryKey({
        user_id: normalizedUserId,
        recovery_key_hash: recoveryKeyHash,
      });

      if (!isValid) {
        Alert.alert('Error', 'Invalid recovery seed phrase or user ID');
        return;
      }

      // Reset the password
      await resetPasswordAdmin({
        user_id: normalizedUserId,
        new_password: newPassword,
      });

      setSeedPhrase('');
      setUserId('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert(
        'Success',
        'Your password has been reset successfully. You can now log in with your new password.',
        [{ text: 'OK', onPress: () => navigation.replace('Login') }]
      );
    } catch (error: any) {
      console.error('Recovery failed:', error);
      Alert.alert('Error', error?.message ?? 'Recovery failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [cleanedSeedPhrase, confirmPassword, navigation, newPassword, userId]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Account Recovery</Text>
          <Text style={styles.subtitle}>
            Enter your recovery seed phrase and set a new password
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>User ID</Text>
            <TextInput
              style={styles.input}
              value={userId}
              onChangeText={setUserId}
              placeholder="@username"
              placeholderTextColor="#6c6c6c"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Recovery Seed Phrase</Text>
            <TextInput
              style={styles.textArea}
              value={seedPhrase}
              onChangeText={(text) => setSeedPhrase(text.toLowerCase())}
              placeholder="Enter your 12-word recovery phrase"
              placeholderTextColor="#6c6c6c"
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor="#6c6c6c"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor="#6c6c6c"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.recoverButton, loading && styles.recoverButtonDisabled]}
            onPress={handleRecover}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.recoverButtonText}>Recover Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
            <Text style={styles.backLinkText}>Back to sign in</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050b12',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#8a94a8',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#101723',
    color: '#ffffff',
    fontSize: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  textArea: {
    backgroundColor: '#101723',
    color: '#ffffff',
    fontSize: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a3441',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  recoverButton: {
    backgroundColor: '#0b5cff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  recoverButtonDisabled: {
    backgroundColor: '#1f3d7a',
  },
  recoverButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  backLink: {
    marginTop: 24,
    alignSelf: 'center',
  },
  backLinkText: {
    color: '#4f9dff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default RecoveryScreen;
