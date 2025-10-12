import React, { useCallback } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const APP_VERSION = '0.0.1';

const FEATURES = [
  {
    title: 'End-to-end Matrix messaging',
    description:
      'MatrixChat connects directly to your homeserver for secure, federated conversations with individuals and rooms.',
  },
  {
    title: 'Seed-based recovery',
    description:
      'Protect your account with a recovery seed. The app stores a secure hash so you can restore access even if you forget your password.',
  },
  {
    title: 'PIN lock',
    description:
      'Add an extra layer of security with an app-specific PIN required every time you open MatrixChat.',
  },
];

const RESOURCES = [
  { label: 'Matrix protocol', url: 'https://matrix.org' },
  { label: 'Matrix API reference', url: 'https://spec.matrix.org/latest/client-server-api/' },
  { label: 'MatrixChat support email', url: 'mailto:support@matrixchat.app' },
];

const AboutScreen = () => {
  const handleOpenLink = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Unable to open link', 'This link is not supported on your device.');
        return;
      }
      await Linking.openURL(url);
    } catch (error: any) {
      Alert.alert('Unable to open link', error?.message ?? 'Please try again later.');
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>MatrixChat</Text>
        <Text style={styles.subtitle}>Secure conversations on the Matrix network.</Text>

        <View style={styles.versionBadge}>
          <Text style={styles.versionLabel}>Version</Text>
          <Text style={styles.versionValue}>{APP_VERSION}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Why MatrixChat?</Text>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureItem}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Resources</Text>
          {RESOURCES.map((item) => (
            <TouchableOpacity key={item.url} style={styles.linkRow} onPress={() => handleOpenLink(item.url)}>
              <Text style={styles.linkText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            MatrixChat is an independent client built for a modern, privacy-first experience. We welcome
            feedback and contributions to keep improving the app.
          </Text>
        </View>
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
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#a0a6b2',
    fontSize: 16,
  },
  versionBadge: {
    backgroundColor: '#0c1421',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'flex-start',
  },
  versionLabel: {
    color: '#6e7b92',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  versionValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#0c1421',
    borderRadius: 18,
    padding: 20,
    gap: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  featureItem: {
    gap: 6,
  },
  featureTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  featureDescription: {
    color: '#8a94a8',
    lineHeight: 20,
  },
  linkRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1c2331',
  },
  linkText: {
    color: '#4f9dff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingBottom: 40,
  },
  footerText: {
    color: '#6e7b92',
    lineHeight: 20,
  },
});

export default AboutScreen;
