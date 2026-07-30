import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import DoctorDashboard from './screens/DoctorDashboard';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <DoctorDashboard />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
