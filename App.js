import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import DoctorDashboard from './screens/DoctorDashboard';
import PatientPortal from './screens/PatientPortal';

export default function App() {
  // حالة التنقل بين الشاشات: 'doctor' أو 'patient'
  const [currentScreen, setCurrentScreen] = useState('doctor');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* شريط التنقل التجريبي العلوي */}
      <View style={styles.navBar}>
        <TouchableOpacity 
          style={[styles.navButton, currentScreen === 'doctor' && styles.activeNavButton]} 
          onPress={() => setCurrentScreen('doctor')}
        >
          <Text style={[styles.navText, currentScreen === 'doctor' && styles.activeNavText]}>
            🩺 لوحة الطبيب
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navButton, currentScreen === 'patient' && styles.activeNavButton]} 
          onPress={() => setCurrentScreen('patient')}
        >
          <Text style={[styles.navText, currentScreen === 'patient' && styles.activeNavText]}>
            👤 بوابة المريض
          </Text>
        </TouchableOpacity>
      </View>

      {/* عرض الشاشة المختارة */}
      <View style={styles.body}>
        {currentScreen === 'doctor' ? (
          <DoctorDashboard />
        ) : (
          <PatientPortal onBackToDashboard={() => setCurrentScreen('doctor')} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  navBar: {
    flexDirection: 'row-reverse',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  activeNavButton: {
    backgroundColor: '#0284C7',
  },
  navText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeNavText: {
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
  },
});
