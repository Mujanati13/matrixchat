import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import RNRestart from 'react-native-restart';

/**
 * Clears all application data and restarts the app
 * This is used for security purposes when PIN attempts are exhausted
 */
export const wipeAppDataAndRestart = async (): Promise<void> => {
  try {
    console.log('Security wipe initiated - clearing all app data...');
    
    // Get all keys before clearing to verify what was stored
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('Keys before wipe:', allKeys);
    
    // Clear all AsyncStorage data
    await AsyncStorage.clear();
    
    // Verify data is cleared
    const keysAfter = await AsyncStorage.getAllKeys();
    console.log('Keys after wipe:', keysAfter);
    
    console.log('All app data cleared, restarting application...');
    
    // Show brief message before restart
    Alert.alert(
      'Security Reset',
      'Application data has been cleared for security. The app will now restart.',
      [
        {
          text: 'OK',
          onPress: () => {
            // Small delay to ensure alert is dismissed
            setTimeout(() => {
              RNRestart.Restart();
            }, 500);
          },
        },
      ],
      { cancelable: false }
    );
  } catch (error) {
    console.error('Error during security wipe:', error);
    // Fallback: still try to restart even if data clearing failed
    RNRestart.Restart();
  }
};

/**
 * Alternative approach: Logout user and clear data without restart
 * Use this if the restart approach isn't working as expected
 */
export const logoutAndClearData = async (logoutFunction: () => Promise<void>): Promise<void> => {
  try {
    console.log('Security logout initiated...');
    
    // First logout the user (this should clear session state)
    await logoutFunction();
    
    // Then clear all local data
    await AsyncStorage.clear();
    
    console.log('User logged out and data cleared');
    
    Alert.alert(
      'Security Lockout',
      'Too many incorrect PIN attempts. You have been logged out for security.',
      [{ text: 'OK' }]
    );
  } catch (error) {
    console.error('Error during security logout:', error);
    // Fallback to clearing storage anyway
    await AsyncStorage.clear();
  }
};

/**
 * Shows a warning when user has made multiple incorrect PIN attempts
 */
export const showPinAttemptsWarning = (attemptsRemaining: number): void => {
  console.log(`PIN attempt failed. Attempts remaining: ${attemptsRemaining}`);
  
  if (attemptsRemaining === 1) {
    Alert.alert(
      '🚨 FINAL ATTEMPT',
      'This is your last chance to enter the correct PIN. If you fail, you will be logged out for security.',
      [{ text: 'I Understand' }]
    );
  } else if (attemptsRemaining === 2) {
    Alert.alert(
      '⚠️ Security Warning',
      `Only ${attemptsRemaining} attempts remaining. After 4 failed attempts, you will be logged out for security.`,
      [{ text: 'OK' }]
    );
  } else if (attemptsRemaining <= 3) {
    Alert.alert(
      'Incorrect PIN',
      `Please try again. ${attemptsRemaining} attempts remaining.`,
      [{ text: 'OK' }]
    );
  }
};