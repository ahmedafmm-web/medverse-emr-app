import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, ScrollView, Platform } from 'react-native';
import DoctorDashboard from './screens/DoctorDashboard';
import PatientPortal from './screens/PatientPortal';

export default function App() {
  // الحالات: 'landing' (المدخل) | 'specialty' (تخصص الطبيب) | 'doctor' (لوحة الطبيب) | 'patient' (بوابة المريض)
  const [currentStep, setCurrentStep] = useState('landing');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');

  // قائمة التخصصات الطبية
  const specialties = [
    { id: 'internal', name: '🩺 الطب الباطني والأمراض المزمنة' },
    { id: 'pediatrics', name: '👶 طب الأطفال وحديثي الولادة' },
    { id: 'cardiology', name: '❤️ أمراض القلب والأوعية الدموية' },
    { id: 'surgery', name: '🔪 الجراحة العامة' },
    { id: 'orthopedics', name: '🦴 جراحة العظام والعضلات' },
    { id: 'dermatology', name: '✨ الجلدية والتجميل' },
  ];

  const handleSpecialtySelect = (specialtyName) => {
    setSelectedSpecialty(specialtyName);
    setCurrentStep('doctor');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* شريط علوي صغير للرجوع للرئيسية */}
      {currentStep !== 'landing' && (
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('landing')}>
            <Text style={styles.backButtonText}>🏠 القائمة الرئيسية / تغيير البوابة</Text>
          </TouchableOpacity>
          {selectedSpecialty !== '' && currentStep === 'doctor' && (
            <Text style={styles.specialtyBadge}>{selectedSpecialty}</Text>
          )}
        </View>
      )}

      {/* 1. شاشة الاختيار الرئيسية (Landing Page) */}
      {currentStep === 'landing' && (
        <ScrollView contentContainerStyle={styles.landingContainer}>
          <Text style={styles.mainTitle}>MedVerse EMR Suite</Text>
          <Text style={styles.subTitle}>منظومة السجلات الطبية الإلكترونية الذكية</Text>
          <Text style={styles.selectPrompt}>الرجاء اختيار البوابة لدخول النظام:</Text>

          <View style={styles.portalCardsContainer}>
            {/* كارت بوابة الطبيب */}
            <TouchableOpacity 
              style={[styles.portalCard, styles.doctorCard]} 
              onPress={() => setCurrentStep('specialty')}
            >
              <Text style={styles.portalIcon}>🩺</Text>
              <Text style={styles.portalTitle}>بوابة الطبيب</Text>
              <Text style={styles.portalDesc}>إدارة المرضى، الاستشارات الإكلينيكية الذكية، وإصدار الروشتات</Text>
            </TouchableOpacity>

            {/* كارت بوابة المريض */}
            <TouchableOpacity 
              style={[styles.portalCard, styles.patientCard]} 
              onPress={() => setCurrentStep('patient')}
            >
              <Text style={styles.portalIcon}>👤</Text>
              <Text style={styles.portalTitle}>بوابة المريض</Text>
              <Text style={styles.portalDesc}>متابعة السجل الطبي، الروشتات المعتمدة، والمواعيد</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* 2. شاشة اختيار التخصص للطبيب */}
      {currentStep === 'specialty' && (
        <ScrollView contentContainerStyle={styles.specialtyContainer}>
          <Text style={styles.sectionTitle}>اختر التخصص الطبي</Text>
          <Text style={styles.sectionSub}>ليتم تهيئة الواجهة وأدوات التشخيص المناسبة لعيادتك</Text>

          <View style={styles.grid}>
            {specialties.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.specialtyCard}
                onPress={() => handleSpecialtySelect(item.name)}
              >
                <Text style={styles.specialtyText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* 3. شاشة لوحة الطبيب */}
      {currentStep === 'doctor' && (
        <View style={styles.body}>
          <DoctorDashboard specialty={selectedSpecialty} />
        </View>
      )}

      {/* 4. شاشة بوابة المريض */}
      {currentStep === 'patient' && (
        <View style={styles.body}>
          <PatientPortal onBackToDashboard={() => setCurrentStep('landing')} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'web' ? 10 : 0 
  },
  topBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  backButton: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  backButtonText: { color: '#38BDF8', fontSize: 13, fontWeight: 'bold' },
  specialtyBadge: { color: '#F1F5F9', backgroundColor: '#0284C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  landingContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  mainTitle: { fontSize: 28, fontWeight: 'bold', color: '#38BDF8', marginTop: 30, textAlign: 'center' },
  subTitle: { fontSize: 16, color: '#94A3B8', marginTop: 8, marginBottom: 30, textAlign: 'center' },
  selectPrompt: { fontSize: 18, color: '#F8FAFC', marginBottom: 20, fontWeight: '600' },
  portalCardsContainer: { width: '100%', maxWidth: 500, gap: 20 },
  portalCard: { padding: 25, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  doctorCard: { backgroundColor: '#1E293B' },
  patientCard: { backgroundColor: '#0F2942' },
  portalIcon: { fontSize: 40, marginBottom: 10 },
  portalTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  portalDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  specialtyContainer: { padding: 20, alignItems: 'center' },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginTop: 20 },
  sectionSub: { fontSize: 14, color: '#94A3B8', marginBottom: 25, textAlign: 'center' },
  grid: { width: '100%', maxWidth: 500, gap: 12 },
  specialtyCard: { backgroundColor: '#1E293B', padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  specialtyText: { color: '#F8FAFC', fontSize: 16, fontWeight: 'bold' },
  body: { flex: 1 }
});
