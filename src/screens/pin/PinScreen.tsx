import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useMatrix } from '@contexts/MatrixContext';
import { usePin } from '@contexts/PinContext';
import { logoutAndClearData, showPinAttemptsWarning } from '@utils/securityUtils';

type Props = {
  mode: 'setup' | 'verify';
  onSuccess: () => void;
};

const PinScreen = ({ mode, onSuccess }: Props) => {
  const { setPin, verifyPin, attemptsRemaining, resetPin } = usePin();
  const { logout } = useMatrix();

  const [pin, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => (mode === 'setup' ? 'Set a PIN' : 'Enter PIN'), [mode]);
  const subtitle = useMemo(
    () =>
      mode === 'setup'
        ? 'Choose a 6-digit PIN that will be required each time you open MatrixChat.'
        : `Unlock MatrixChat with your PIN.\n\n⚠️ Security: After 4 incorrect attempts, you will be logged out.`,
    [mode],
  );

  const handleSetup = useCallback(async () => {
    if (pin.length < 4) {
      Alert.alert('PIN too short', 'Please choose at least 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('PIN mismatch', 'The confirmation PIN does not match.');
      return;
    }

    setLoading(true);
    try {
      await setPin(pin);
      onSuccess();
    } finally {
      setLoading(false);
    }
  }, [confirmPin, onSuccess, pin, setPin]);

  const handleVerify = useCallback(async () => {
    setLoading(true);
    try {
      const result = await verifyPin(pin);
      if (result.valid) {
        onSuccess();
        return;
      }

      if (result.attemptsRemaining <= 0) {
        console.log('PIN attempts exhausted - initiating security logout');
        Alert.alert(
          '🔒 Security Lockout',
          'Too many incorrect PIN attempts. You will be logged out for security.',
          [
            {
              text: 'OK',
              onPress: () => logoutAndClearData(logout),
            },
          ],
          { cancelable: false }
        );
      } else {
        // Show progressive warnings as attempts decrease
        showPinAttemptsWarning(result.attemptsRemaining);
      }
    } finally {
      setLoading(false);
      setPinInput('');
    }
  }, [logout, onSuccess, pin, verifyPin]);

  const handleSubmit = mode === 'setup' ? handleSetup : handleVerify;

  const showConfirmField = mode === 'setup';

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {mode === 'verify' && attemptsRemaining < 4 && (
          <View style={styles.attemptsWarning}>
            <Text style={styles.attemptsText}>
              ⚠️ Attempts remaining: {attemptsRemaining}
            </Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>PIN</Text>
          <TextInput
            value={pin}
            onChangeText={setPinInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            style={styles.input}
            placeholder="••••"
            placeholderTextColor="#566078"
          />
        </View>

        {showConfirmField && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Confirm PIN</Text>
            <TextInput
              value={confirmPin}
              onChangeText={setConfirmPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={styles.input}
              placeholder="••••"
              placeholderTextColor="#566078"
            />
          </View>
        )}

        {mode === 'verify' && attemptsRemaining < 3 && attemptsRemaining > 0 ? (
          <Text style={styles.warning}>Attempts remaining: {attemptsRemaining}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Please wait…' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050b12',
    paddingHorizontal: 24,
    paddingVertical: 64,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    color: '#9aa3b7',
    fontSize: 15,
    marginBottom: 32,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#7d89a1',
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#101723',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    fontSize: 18,
    letterSpacing: 4,
    color: '#ffffff',
  },
  warning: {
    color: '#ffb347',
    textAlign: 'center',
    marginBottom: 24,
  },
  attemptsWarning: {
    backgroundColor: '#ff4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  attemptsText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#0b5cff',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#1f3d7a',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default PinScreen;
