import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, TextInput, Button, Card, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store/useAppStore.js';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password123');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const { apiUrl, setUser, setToken, setStore, setDeviceId, showToast } = useAppStore();

  const handleOnlineLogin = async () => {
    if (!username.trim() || !password.trim()) {
      showToast('Please enter username and password', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setUser(data.data.user);
      setStore(data.data.store);
      setToken(data.data.tokens.accessToken);
      setDeviceId(data.data.deviceId);

      showToast(`Welcome back to ${data.data.store.name}!`, 'success');
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      showToast(`${msg}. You can continue offline.`, 'info');
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineUnlock = () => {
    // Allows shopkeeper to unlock terminal offline
    router.replace('/(tabs)');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <View style={styles.logoHeaderWrapper}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.loginLogo}
              resizeMode="contain"
            />
          </View>
        </View>
        <Card.Title
          title="MANJU STORES"
          subtitle="Stock Management & Billing"
          titleStyle={styles.title}
          subtitleStyle={styles.subtitle}
        />
        <Card.Content>
          <TextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />
          <Button
            mode="contained"
            onPress={handleOnlineLogin}
            loading={loading}
            style={styles.button}
          >
            Login Online & Sync
          </Button>

          <Divider style={styles.divider} />

          <Text variant="labelMedium" style={styles.offlineHeading}>
            Quick Offline Terminal Access
          </Text>
          <TextInput
            label="4-Digit Offline PIN (Optional)"
            value={pin}
            onChangeText={setPin}
            mode="outlined"
            keyboardType="numeric"
            maxLength={4}
            secureTextEntry
            style={styles.input}
          />
          <Button
            mode="outlined"
            onPress={handleOfflineUnlock}
            style={styles.offlineBtn}
          >
            Continue Offline
          </Button>

          <Button
            mode="text"
            onPress={() => router.push('/(auth)/register-store')}
            style={styles.registerBtn}
          >
            Setup New Store
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#0F172A',
  },
  card: {
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 16,
  },
  logoHeaderWrapper: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  loginLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#38BDF8',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94A3B8',
    textAlign: 'center',
  },
  input: {
    marginBottom: 14,
    backgroundColor: '#0F172A',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#38BDF8',
  },
  divider: {
    marginVertical: 20,
    backgroundColor: '#334155',
  },
  offlineHeading: {
    color: '#F59E0B',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  offlineBtn: {
    borderColor: '#F59E0B',
  },
  registerBtn: {
    marginTop: 15,
  },
});
