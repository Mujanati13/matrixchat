import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useMatrix } from '@contexts/MatrixContext';
import { usePin } from '@contexts/PinContext';
import {
  clearPendingRecoveryBackup,
  loadPendingRecoveryBackup,
  PendingRecoveryBackup,
} from '@storage/recoveryBackup';
import { storeRecoveryKeyAccountData } from '@services/matrixApi';
import { isRecoveryEndpointMissing, storeRecoveryKey } from '@services/recoveryApi';

const SettingsScreen = () => {
  const { session, logout, deleteAccount } = useMatrix();
  const { resetPin } = usePin();
  const [pendingBackup, setPendingBackup] = useState<PendingRecoveryBackup | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [logoutInFlight, setLogoutInFlight] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadPending = useCallback(async () => {
    const value = await loadPendingRecoveryBackup();
    if (isMountedRef.current) {
      setPendingBackup(value);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPending();
    }, [loadPending]),
  );

  const handleRetryBackup = useCallback(async () => {
    if (!pendingBackup) {
      Alert.alert('No recovery key to back up', 'There is no pending recovery key on this device.');
      return;
    }

    if (!session) {
      Alert.alert(
        'Session required',
        'Please sign in again to retry backing up your recovery key.',
      );
      return;
    }

    setRetrying(true);
    try {
      await storeRecoveryKey({ user_id: session.userId, recovery_key_hash: pendingBackup.recoveryKeyHash });
      await clearPendingRecoveryBackup();
      if (isMountedRef.current) {
        setPendingBackup(null);
      }
      Alert.alert('Recovery key backed up', 'Your recovery key has been saved securely.');
    } catch (error: any) {
      if (isRecoveryEndpointMissing(error)) {
        try {
          await storeRecoveryKeyAccountData(session, pendingBackup.recoveryKeyHash);
          await clearPendingRecoveryBackup();
          if (isMountedRef.current) {
            setPendingBackup(null);
          }
          Alert.alert('Recovery key backed up', 'Your recovery key has been saved securely.');
          return;
        } catch (fallbackError: any) {
          console.warn('Fallback recovery storage failed', fallbackError);
        }
      }
      const message =
        error?.response?.data?.error ?? error?.message ?? 'Unable to back up the recovery key.';
      Alert.alert('Backup failed', String(message));
    } finally {
      if (isMountedRef.current) {
        setRetrying(false);
      }
    }
  }, [pendingBackup, session]);

  const performLogout = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }

    setLogoutInFlight(true);
    try {
      await clearPendingRecoveryBackup();
      if (isMountedRef.current) {
        setPendingBackup(null);
      }
      await resetPin();
      await logout();
    } catch (error: any) {
      const message = error?.response?.data?.error ?? error?.message ?? 'Unable to log out right now.';
      Alert.alert('Logout failed', String(message));
    } finally {
      if (isMountedRef.current) {
        setLogoutInFlight(false);
      }
    }
  }, [logout, resetPin]);

  const handleLogout = useCallback(() => {
    Alert.alert('Log out', 'Are you sure you want to sign out of this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  }, [performLogout]);

  const performDeleteAccount = useCallback(
    async (password: string) => {
      if (!isMountedRef.current) {
        return;
      }

      setDeleteInFlight(true);
      try {
        await deleteAccount(password);
        await resetPin();
        await clearPendingRecoveryBackup();
        if (isMountedRef.current) {
          setPendingBackup(null);
          setDeletePassword('');
          Alert.alert('Account deleted', 'Your account has been removed.');
        }
      } catch (error: any) {
        const message =
          error?.response?.data?.error ??
          error?.response?.data?.errcode ??
          error?.message ??
          'Unable to delete the account right now.';
        Alert.alert('Deletion failed', String(message));
      } finally {
        if (isMountedRef.current) {
          setDeleteInFlight(false);
        }
      }
    },
    [deleteAccount, resetPin],
  );

  const handleDeleteAccount = useCallback(() => {
    const password = deletePassword.trim();
    if (!password) {
      Alert.alert('Password required', 'Enter your current password to delete your account.');
      return;
    }

    Alert.alert(
      'Delete account',
      'This will permanently remove your Matrix account and erase your data from this device. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void performDeleteAccount(password);
          },
        },
      ],
    );
  }, [deletePassword, performDeleteAccount]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recovery backup</Text>
        {pendingBackup ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>
              We still need to back up your recovery key for user:
              {'\n'}
              <Text style={styles.highlight}>{pendingBackup.userId}</Text>
            </Text>
            <Text style={styles.cardHint}>
              Tap retry when you have a stable connection. This ensures you can restore access if
              you lose your device.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, retrying && styles.primaryButtonDisabled]}
              onPress={handleRetryBackup}
              disabled={retrying}
            >
              <Text style={styles.primaryButtonText}>
                {retrying ? 'Retrying…' : 'Retry backup now'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardText}>Your recovery key is safely backed up.</Text>
            <Text style={styles.cardHint}>
              If we detect an issue in the future, a retry option will appear here.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>Need to leave this device?</Text>
          <Text style={styles.cardHint}>
            Logging out will remove your session from this device. You can sign back in with your
            username, password, and PIN.
          </Text>
          <TouchableOpacity
            style={[styles.secondaryButton, logoutInFlight && styles.secondaryButtonDisabled]}
            onPress={handleLogout}
            disabled={logoutInFlight}
          >
            <Text style={styles.secondaryButtonText}>
              {logoutInFlight ? 'Logging out…' : 'Log out'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.cardText, styles.dangerText]}>Delete account permanently</Text>
          <Text style={[styles.cardHint, styles.dangerText]}>
            This cannot be undone. Enter your password to confirm and remove your account from the
            homeserver.
          </Text>
          <TextInput
            value={deletePassword}
            onChangeText={setDeletePassword}
            placeholder="Current password"
            placeholderTextColor="#6c6c6c"
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
            editable={!deleteInFlight}
          />
          <TouchableOpacity
            style={[styles.dangerButton, (deleteInFlight || !deletePassword.trim()) && styles.dangerButtonDisabled]}
            onPress={handleDeleteAccount}
            disabled={deleteInFlight || !deletePassword.trim()}
          >
            <Text style={styles.dangerButtonText}>
              {deleteInFlight ? 'Deleting…' : 'Delete account'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#04070d',
    flexGrow: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#d6dcff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#0a101a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1c2331',
  },
  cardText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
  },
  cardHint: {
    color: '#7b869d',
    marginTop: 12,
    lineHeight: 20,
  },
  highlight: {
    color: '#8fb1ff',
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#0b5cff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#1f3d7a',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 20,
    backgroundColor: '#1c2331',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerCard: {
    marginTop: 20,
    borderColor: '#40212c',
    backgroundColor: '#14080d',
  },
  dangerText: {
    color: '#ff8297',
  },
  input: {
    marginTop: 16,
    backgroundColor: '#10141d',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#1c2331',
  },
  dangerButton: {
    marginTop: 20,
    backgroundColor: '#ff3b5c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerButtonDisabled: {
    backgroundColor: '#7a2c3f',
  },
  dangerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;
