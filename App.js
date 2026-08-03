import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, ScrollView, Platform } from 'react-native';
import DoctorDashboard from './screens/DoctorDashboard';
import PatientPortal from './screens/PatientPortal';

export default function App() {
  const [currentStep, setCurrentStep] = useState('landing');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [encryptedClinicId, setEncryptedClinicId] = useState(null);
  const [directPatientCode, setDirectPatientCode] = useState(null);

  const specialties = [
    { id: 'internal', name: '🩺 الطب الباطني والأمراض المزمنة' },
    { id: 'rheumatology', name: '🩺 أمراض الروماتيزم والروماتويد والأمراض المناعية' },
    { id: 'pediatrics', name: '👶 طب الأطفال وحديثي الولادة' },
    { id: 'cardiology', name: '❤️ أمراض القلب والأوعية الدموية' },
    { id: 'surgery', name: '🔪 الجراحة العامة' },
    { id: 'orthopedics', name: '🦴 جراحة العظام والمفاصل' },
    { id: 'dermatology', name: '✨ الجلدية والتجميل' },
  ];

  useEffect(() => {
    // معالجة روابط التوجيه الذكية من الـ URL عند الفتح بالمتصفح
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('clinic') || urlParams.get('c') || urlParams.get('patient');
      
      if (queryParam) {
        if (queryParam.startsWith('PAT-')) {
          setDirectPatientCode(queryParam);
          setEncryptedClinicId(null);
        } else {
          setEncryptedClinicId(queryParam);
          setDirectPatientCode(null);
        }
        setCurrentStep('patient');
      }
    }
  }, []);

  const handleSpecialtySelect = (specialtyName) => {
    setSelectedSpecialty(specialtyName || '');
    setCurrentStep('doctor');
  };

  const handleResetToLanding = () => {
    setSelectedSpecialty('');
    setDirectPatientCode(null);
    setCurrentStep('landing');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#090D16" />

      {currentStep !== 'landing' && (
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleResetToLanding}
          >
            <Text style={styles.backButtonText}>🏠 القائمة الرئيسية / تغيير البوابة</Text>
          </TouchableOpacity>
          {selectedSpecialty !== '' && currentStep === 'doctor' && (
            <Text style={styles.specialtyBadge}>{selectedSpecialty}</Text>
          )}
        </View>
      )}

      {currentStep === 'landing' && (
        <ScrollView contentContainerStyle={styles.landingContainer}>
          <Text style={styles.mainTitle}>MedVerse EMR Suite</Text>
          <Text style={styles.subTitle}>منظومة السجلات الطبية الإلكترونية الذكية</Text>
          <Text style={styles.selectPrompt}>الرجاء اختيار البوابة لدخول النظام:</Text>

          <View style={styles.portalCardsContainer}>
            <TouchableOpacity 
              style={[styles.portalCard, styles.doctorCard]} 
              onPress={() => setCurrentStep('specialty')}
            >
              <Text style={styles.portalIcon}>🩺</Text>
              <Text style={styles.portalTitle}>بوابة الطبيب</Text>
              <Text style={styles.portalDesc}>إدارة المرضى، الاستشارات الإكلينيكية الذكية، وإصدار الروشتات</Text>
            </TouchableOpacity>

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

      {currentStep === 'doctor' && (
        <View style={styles.body}>
          <DoctorDashboard 
            specialty={selectedSpecialty} 
            onSwitchPortal={handleResetToLanding}
            onUpdateSpecialty={(newSpec) => setSelectedSpecialty(newSpec)}
          />
        </View>
      )}

      {currentStep === 'patient' && (
        <View style={styles.body}>
          <PatientPortal 
            onBackToDashboard={handleResetToLanding} 
            doctorClinicId={encryptedClinicId}
            initialPatientCode={directPatientCode}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D16', paddingTop: Platform.OS === 'web' ? 0 : 0 },
  topBar: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#131C2E', paddingHorizontal: 15, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1E293B'
  },
  backButton: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  backButtonText: { color: '#00F2FE', fontSize: 13, fontWeight: 'bold' },
  specialtyBadge: { color: '#FFFFFF', backgroundColor: '#0284C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  landingContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  mainTitle: { fontSize: 28, fontWeight: '900', color: '#00F2FE', marginTop: 30, textAlign: 'center', letterSpacing: 0.5 },
  subTitle: { fontSize: 15, color: '#94A3B8', marginTop: 8, marginBottom: 30, textAlign: 'center' },
  selectPrompt: { fontSize: 17, color: '#F8FAFC', marginBottom: 20, fontWeight: '600' },
  portalCardsContainer: { width: '100%', maxWidth: 500, gap: 20 },
  portalCard: { padding: 25, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  doctorCard: { backgroundColor: '#131C2E' },
  patientCard: { backgroundColor: '#0C1929' },
  portalIcon: { fontSize: 40, marginBottom: 10 },
  portalTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  portalDesc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  specialtyContainer: { padding: 20, alignItems: 'center' },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginTop: 20 },
  sectionSub: { fontSize: 13, color: '#94A3B8', marginBottom: 25, textAlign: 'center' },
  grid: { width: '100%', maxWidth: 500, gap: 12 },
  specialtyCard: { backgroundColor: '#131C2E', padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', alignItems: 'center' },
  specialtyText: { color: '#F8FAFC', fontSize: 15, fontWeight: 'bold' },
  body: { flex: 1 }
});
