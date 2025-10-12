import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActionSheetIOS,
} from 'react-native';

import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { launchImageLibrary, launchCamera, MediaType, ImagePickerResponse, ImageLibraryOptions, CameraOptions } from 'react-native-image-picker';

import { useMatrix } from '@contexts/MatrixContext';
import { useFlow } from '@contexts/FlowContext';
import { homeserverName, uploadAvatar, updateAvatarUrl } from '@services/matrixApi';
import { storeRecoveryKey } from '@services/recoveryApi';
import { sha256Hex } from '@utils/hash';
import {
  clearPendingRecoveryBackup,
  savePendingRecoveryBackup,
} from '@storage/recoveryBackup';

const BACKUP_RETRY_ATTEMPTS = 3;
const BACKUP_RETRY_DELAY_MS = 2000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

const MIN_PASSWORD_LENGTH = 8;

const normaliseUsername = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('@')) {
    return trimmed.slice(1).split(':')[0];
  }
  if (trimmed.includes(':')) {
    return trimmed.split(':')[0];
  }
  return trimmed;
};

const SignupScreen = () => {
  const { register } = useMatrix();
  const { setSeedPayload } = useFlow();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<{ uri: string; type?: string; fileName?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const cleanedUsername = useMemo(() => normaliseUsername(username), [username]);

  const handleImagePicker = useCallback(() => {
    const libraryOptions: ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 800,
      maxWidth: 800,
    };

    const cameraOptions: CameraOptions = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 800,
      maxWidth: 800,
    };

    const handleImageResponse = (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        if (asset.uri) {
          setProfilePhoto({
            uri: asset.uri,
            type: asset.type,
            fileName: asset.fileName,
          });
        }
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Choose from Library', 'Take Photo'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            launchImageLibrary(libraryOptions, handleImageResponse);
          } else if (buttonIndex === 2) {
            launchCamera(cameraOptions, handleImageResponse);
          }
        }
      );
    } else {
      Alert.alert(
        'Select Image',
        'Choose an option',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Gallery',
            onPress: () => launchImageLibrary(libraryOptions, handleImageResponse),
          },
          {
            text: 'Camera',
            onPress: () => launchCamera(cameraOptions, handleImageResponse),
          },
        ]
      );
    }
  }, []);

  const canSubmit =
    cleanedUsername.length > 0 &&
    password.trim().length >= MIN_PASSWORD_LENGTH &&
    confirmPassword.trim().length >= MIN_PASSWORD_LENGTH &&
    !loading;

  const handleSignup = useCallback(async () => {
    if (!canSubmit) {
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'The passwords you entered do not match.');
      return;
    }

    setLoading(true);

    try {
      const mnemonic = generateMnemonic(wordlist, 128);
      const words = mnemonic.split(' ');
      const recoveryHash = sha256Hex(mnemonic);

      const session = await register(cleanedUsername, password.trim());

      let recoveryStored = false;
      const payload = { user_id: session.userId, recovery_key_hash: recoveryHash };

      // First, try the recovery API with automatic fallback
      for (let attempt = 1; attempt <= BACKUP_RETRY_ATTEMPTS; attempt += 1) {
        try {
          await storeRecoveryKey(payload, {
            access_token: session.accessToken,
            user_id: session.userId,
          });
          recoveryStored = true;
          await clearPendingRecoveryBackup();
          console.log('Recovery key stored successfully');
          break;
        } catch (storeError: any) {
          console.warn(`Recovery API attempt ${attempt} failed:`, storeError.message);
          
          if (attempt === BACKUP_RETRY_ATTEMPTS) {
            console.error('All recovery storage attempts failed');
            break;
          }
          
          if (attempt < BACKUP_RETRY_ATTEMPTS) {
            console.log(`Retrying recovery key storage in ${BACKUP_RETRY_DELAY_MS * attempt}ms...`);
            await wait(BACKUP_RETRY_DELAY_MS * attempt);
          }
        }
      }

      console.log('Setting seed payload with words:', words.length, 'hash:', recoveryHash.substring(0, 10) + '...');
      setSeedPayload({ words, hash: recoveryHash });
      console.log('Seed payload set successfully');

      // Upload profile photo if one was selected
      if (profilePhoto) {
        try {
          console.log('Uploading profile photo...');
          const fileName = profilePhoto.fileName || `profile_${Date.now()}.jpg`;
          const mimeType = profilePhoto.type || 'image/jpeg';
          const avatarUrl = await uploadAvatar(session, profilePhoto.uri, mimeType, fileName);
          await updateAvatarUrl(session, avatarUrl);
          console.log('Profile photo uploaded successfully');
        } catch (photoError) {
          console.warn('Failed to upload profile photo:', photoError);
          // Don't fail the whole signup process if photo upload fails
        }
      }

      if (!recoveryStored) {
        await savePendingRecoveryBackup({ userId: session.userId, recoveryKeyHash: recoveryHash });
        console.warn('Recovery key storage failed, saved for retry later');
        Alert.alert(
          'Account Created Successfully',
          'Your account was created! Your recovery key will be backed up automatically when you have a stable connection. You can also manually retry from Settings.',
        );
      } else {
        console.log('Account creation and recovery backup completed successfully');
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.error ??
        error?.response?.data?.errcode ??
        error?.message ??
        'Sign up failed, please try again.';
      Alert.alert('Could not create account', String(message));
    } finally {
      setLoading(false);
    }
  }, [canSubmit, cleanedUsername, confirmPassword, password, register, setSeedPayload]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          {`Pick a unique username. Your Matrix ID will look like @username`}
        </Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor="#6c6c6c"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Profile Photo (Optional)</Text>
          <TouchableOpacity 
            style={styles.photoButton}
            onPress={handleImagePicker}
            disabled={loading}
          >
            {profilePhoto ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: profilePhoto.uri }} style={styles.profilePhoto} />
                <TouchableOpacity 
                  style={styles.removePhotoButton}
                  onPress={() => setProfilePhoto(null)}
                  disabled={loading}
                >
                  <Text style={styles.removePhotoText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>+</Text>
                <Text style={styles.photoLabel}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            placeholderTextColor="#6c6c6c"
            secureTextEntry
            style={styles.input}
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm your password"
            placeholderTextColor="#6c6c6c"
            secureTextEntry
            style={styles.input}
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={!canSubmit}
        >
          <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Sign up'}</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          By creating an account you agree to securely store your recovery seed and PIN.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04070d',
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a6b2',
    marginBottom: 32,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    color: '#8a909f',
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#10141d',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#1c2331',
  },
  button: {
    marginTop: 12,
    backgroundColor: '#0b5cff',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#1f3d7a',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  hint: {
    color: '#515a70',
    fontSize: 13,
    marginTop: 24,
    lineHeight: 18,
    textAlign: 'center',
  },
  photoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: '#1c2331',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2a3441',
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    fontSize: 24,
    color: '#6c6c6c',
    fontWeight: '300',
  },
  photoLabel: {
    fontSize: 12,
    color: '#6c6c6c',
    marginTop: 4,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  photoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff5722',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default SignupScreen;
