import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMatrix } from '@contexts/MatrixContext';
import { usePin } from '@contexts/PinContext';
import { fetchUserProfile } from '@services/matrixApi';

const ProfileScreen = () => {
  const { session, updateDisplayName, updateAvatarUrl, logout } = useMatrix();
  const { hasPin, attemptsRemaining, resetPin } = usePin();

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [initialDisplayName, setInitialDisplayName] = useState('');
  const [initialAvatarUrl, setInitialAvatarUrl] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinResetting, setPinResetting] = useState(false);

  const matrixId = session?.userId ?? '';
  const homeserver = session?.homeserver ?? '';

  const hasPendingChanges = useMemo(() => {
    return (
      displayName.trim() !== initialDisplayName.trim() ||
      avatarUrl.trim() !== initialAvatarUrl.trim()
    );
  }, [avatarUrl, displayName, initialAvatarUrl, initialDisplayName]);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!session) {
        setLoadingProfile(false);
        return;
      }
      setLoadingProfile(true);
      try {
        const profile = await fetchUserProfile(session);
        if (!cancelled) {
          const currentDisplay = profile.displayName ?? '';
          const currentAvatar = profile.avatarUrl ?? '';
          setDisplayName(currentDisplay);
          setAvatarUrl(currentAvatar);
          setInitialDisplayName(currentDisplay);
          setInitialAvatarUrl(currentAvatar);
        }
      } catch (error: any) {
        if (!cancelled) {
          Alert.alert('Profile', error?.message ?? 'Unable to load profile details.');
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleSave = useCallback(async () => {
    if (!session) {
      return;
    }
    setSaving(true);
    try {
      const actions: Array<Promise<void>> = [];
      const nextDisplayName = displayName.trim();
      const nextAvatarUrl = avatarUrl.trim();
      if (nextDisplayName !== initialDisplayName.trim()) {
        actions.push(updateDisplayName(nextDisplayName));
      }
      if (nextAvatarUrl !== initialAvatarUrl.trim() && nextAvatarUrl.length > 0) {
        actions.push(updateAvatarUrl(nextAvatarUrl));
      }
      await Promise.all(actions);
      setInitialDisplayName(nextDisplayName);
      setInitialAvatarUrl(nextAvatarUrl);
      Alert.alert('Profile updated', 'Your changes were saved.');
    } catch (error: any) {
      const message = error?.response?.data?.error ?? error?.message ?? 'Unable to save changes.';
      Alert.alert('Update failed', String(message));
    } finally {
      setSaving(false);
    }
  }, [avatarUrl, displayName, session, updateAvatarUrl, updateDisplayName]);

  const handleResetPin = useCallback(() => {
    Alert.alert(
      'Reset PIN',
      'This will remove your existing PIN. You will be asked to set a new one next time you open the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset PIN',
          style: 'destructive',
          onPress: async () => {
            setPinResetting(true);
            try {
              await resetPin();
              Alert.alert('PIN reset', 'Your PIN has been cleared.');
            } finally {
              setPinResetting(false);
            }
          },
        },
      ],
    );
  }, [resetPin]);

  const handleLogout = useCallback(async () => {
    Alert.alert('Log out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }, [logout]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your Account</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Matrix ID</Text>
          <Text style={styles.cardValue}>{matrixId}</Text>
          <Text style={styles.cardLabel}>Homeserver</Text>
          <Text style={styles.cardValue}>{homeserver}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Display name</Text>
          {loadingProfile ? (
            <ActivityIndicator color="#4f9dff" style={styles.inlineSpinner} />
          ) : (
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
              placeholder="How others see you"
              placeholderTextColor="#6c6c6c"
            />
          )}

          <Text style={[styles.cardLabel, styles.spacingTop]}>Avatar URL (mxc:// or https://)</Text>
          {loadingProfile ? (
            <ActivityIndicator color="#4f9dff" style={styles.inlineSpinner} />
          ) : (
            <TextInput
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              style={styles.input}
              placeholder="Optional avatar URL"
              placeholderTextColor="#6c6c6c"
              autoCapitalize="none"
            />
          )}

          <TouchableOpacity
            style={[styles.primaryButton, (!hasPendingChanges || saving) && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={!hasPendingChanges || saving}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Security</Text>
          <Text style={styles.cardValue}>{hasPin ? 'PIN enabled' : 'No PIN set'}</Text>
          <Text style={styles.pinInfo}>Attempts remaining: {attemptsRemaining}</Text>
          <TouchableOpacity
            style={[styles.secondaryButton, pinResetting && styles.secondaryButtonDisabled]}
            onPress={handleResetPin}
            disabled={pinResetting}
          >
            <Text style={styles.secondaryButtonText}>{pinResetting ? 'Resetting…' : 'Reset PIN'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#04070d',
  },
  container: {
    padding: 24,
    gap: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0c1421',
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  cardLabel: {
    color: '#6e7b92',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#101723',
    color: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1c2331',
  },
  inlineSpinner: {
    marginVertical: 12,
  },
  spacingTop: {
    marginTop: 8,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#0b5cff',
    paddingVertical: 16,
    borderRadius: 14,
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
    marginTop: 12,
    backgroundColor: '#101723',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: '#4f9dff',
    fontSize: 15,
    fontWeight: '600',
  },
  pinInfo: {
    color: '#8a94a8',
  },
  logoutButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  logoutText: {
    color: '#ff6666',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;
