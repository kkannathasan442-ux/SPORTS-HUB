import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MobileContainer } from './src/components/MobileContainer';
import { MobileButton } from './src/components/MobileButton';
import { APP_CONFIG } from '@sportshub/config';

export default function App() {
  return (
    <MobileContainer>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {/* Brand Icon Badge */}
        <View style={styles.badgeContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>S</Text>
          </View>
        </View>

        {/* Brand Header */}
        <Text style={styles.title}>{APP_CONFIG.name}</Text>
        <Text style={styles.tagline}>{APP_CONFIG.tagline}</Text>

        {/* Phase Info */}
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>FOUNDATION STATUS</Text>
          <Text style={styles.statusValue}>STEP 3 — Auth & Multi-Tenant Foundation</Text>
        </View>

        {/* Action Button */}
        <View style={styles.buttonWrapper}>
          <MobileButton
            title="Get Started"
            onPress={() => {
              // Action handler placeholder for future steps
            }}
          />
        </View>
      </View>
    </MobileContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  badgeContainer: {
    marginBottom: 20,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#0B192C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  logoBadgeText: {
    color: '#38BDF8',
    fontSize: 32,
    fontWeight: '900',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0B192C',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
    textAlign: 'center',
  },
  statusBox: {
    marginTop: 28,
    marginBottom: 36,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    letterSpacing: 1,
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    marginTop: 2,
  },
  buttonWrapper: {
    width: '100%',
    maxWidth: 320,
  },
});
