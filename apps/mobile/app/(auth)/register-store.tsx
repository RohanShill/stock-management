import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store/useAppStore.js';
import { getDatabase } from '../../src/database/db.js';

export default function RegisterStoreScreen() {
  const router = useRouter();
  const [storeName, setStoreName] = useState('Shree Ram Hardware');
  const [ownerName, setOwnerName] = useState('Rajesh Sharma');
  const [username, setUsername] = useState('rajesh');
  const [password, setPassword] = useState('password123');
  const [phone, setPhone] = useState('9876543210');
  const [address, setAddress] = useState('Main Market, Shop 42, Jaipur');
  const [gstin, setGstin] = useState('08AABCS1429B1Z');
  const [loading, setLoading] = useState(false);

  const { apiUrl, setUser, setToken, setStore, setDeviceId, showToast } = useAppStore();

  const handleRegister = async () => {
    if (!storeName || !ownerName || !username || !password || !phone || !address) {
      showToast('Please fill all mandatory store details.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/register-store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName,
          ownerName,
          username,
          password,
          phone,
          address,
          gstin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setUser(data.data.user);
      setStore(data.data.store);
      setToken(data.data.tokens.accessToken);
      setDeviceId(data.data.deviceId);

      // Save initial store into local SQLite database
      const db = await getDatabase();
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT OR REPLACE INTO stores (id, name, ownerName, phone, address, gstin, currency, defaultTaxRatePercent, invoicePrefix, invoiceSequence, negativeStockAllowed, pipeTrackingMethod, costingMethod, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'INR', 18, 'INV', 1000, 0, 'aggregate', 'weighted_average', ?, ?);`,
        [
          data.data.store.id,
          storeName,
          ownerName,
          phone,
          address,
          gstin,
          now,
          now,
        ]
      );

      showToast(`Store '${storeName}' is now set up and ready!`, 'success');
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Card.Title
          title="First-Time Store Setup"
          subtitle="Configure your hardware business"
          titleStyle={styles.title}
          subtitleStyle={styles.subtitle}
        />
        <Card.Content>
          <TextInput
            label="Hardware Store Name *"
            value={storeName}
            onChangeText={setStoreName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Owner / Contact Person *"
            value={ownerName}
            onChangeText={setOwnerName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Admin Username *"
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            label="Admin Password *"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />
          <TextInput
            label="10-Digit Mobile Phone *"
            value={phone}
            onChangeText={setPhone}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />
          <TextInput
            label="Store Address *"
            value={address}
            onChangeText={setAddress}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="GSTIN Number (Optional)"
            value={gstin}
            onChangeText={setGstin}
            mode="outlined"
            style={styles.input}
          />
          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            style={styles.button}
          >
            Create Store & Start
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#0F172A',
  },
  card: {
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#38BDF8',
  },
  subtitle: {
    color: '#94A3B8',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#0F172A',
  },
  button: {
    marginTop: 12,
    backgroundColor: '#10B981',
  },
});
