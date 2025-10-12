import React, { useCallback, useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@navigation/RootNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LoginScreen = ({ navigation }: Props) => {
  const { login, roomsLoading } = useMatrix();
  const [matrixId, setMatrixId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = matrixId.trim().length > 0 && password.trim().length > 0 && !loading;

  const handleLogin = useCallback(async () => {
    if (!canSubmit) {
      return;
    }
    try {
      setLoading(true);
      await login(matrixId, password);
      setPassword('');
    } catch (error: any) {
      const message = error?.response?.data?.error ?? error?.message ?? 'Login failed';
      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  }, [canSubmit, login, matrixId, password]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        <Text style={styles.title}>MatrixChat</Text>
        <Text style={styles.subtitle}>Secure conversations over Matrix</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Matrix ID</Text>
          <TextInput
            value={matrixId}
            onChangeText={setMatrixId}
            placeholder="username"
            placeholderTextColor="#6c6c6c"
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#6c6c6c"
            secureTextEntry
            style={styles.input}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={!canSubmit}
        >
          <Text style={styles.buttonText}>{loading || roomsLoading ? 'Signing in…' : 'Sign in'}</Text>
        </TouchableOpacity>

        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Recovery')}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.link}>Create account</Text>
          </TouchableOpacity>
        </View>
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
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  link: {
    color: '#4f9dff',
    fontSize: 14,
  },
});

export default LoginScreen;
