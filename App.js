import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, ScrollView, Platform } from 'react-native';
import DoctorDashboard from './screens/DoctorDashboard';
import PatientPortal from './screens/PatientPortal';

export default function App() {
  // 1. قراءة واسترجاع الحالة السابقة من الـ localStorage لمنع الخروج عند الـ Refresh
  const [currentStep, setCurrentStep] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('medverse_current_step') || 'landing';
    }
    return 'landing';
  });

  const [selectedSpecialty, setSelectedSpecialty] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('medverse_selected_specialty') || '';
    }
    return '';
  });

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

  // 2. معالجة روابط الـ URL الخارجية المباشرة (روابط المشاركة للعيادة أو المريض)
  useEffect(() => {
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
        updateStep('patient');
      }
    }
  }, []);

  // 3. دالة تحديث الشاشات والحفظ التلقائي في الـ LocalStorage
  const updateStep = (newStep) => {
    setCurrentStep(newStep);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('medverse_current_step', newStep);
    }
  };

  const updateSpecialty = (newSpec) => {
    setSelectedSpecialty(newSpec || '');
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('medverse_selected_specialty', newSpec || '');
    }
  };

  const handleSpecialtySelect = (specialtyName) => {
    updateSpecialty(specialtyName);
    updateStep('doctor');
  };

  const handleResetToLanding = () => {
    updateSpecialty('');
    setDirectPatientCode(null);
    setEncryptedClinicId(null);
    updateStep('landing');

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('medverse_current_step');
      localStorage.removeItem('medverse_selected_specialty');
      localStorage.removeItem('medverse_doctor_active_tab');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#060911" />

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
          {/* Header & Branding Zone */}
          <View style={styles.headerGlowBox}>
            <Text style={styles.mainTitle}>MedVerse EMR Suite</Text>
            
            {/* DEVEXT Brand Badge */}
            <View style={styles.brandRow}>
              <Text style={styles.brandTag}>POWERED BY</Text>
              <Text style={styles.brandSubtitle}>DEVEXT</Text>
            </View>

            <Text style={styles.subTitle}>منظومة السجلات الطبية الإلكترونية الذكية</Text>
          </View>

          <Text style={styles.selectPrompt}>الرجاء اختيار البوابة لدخول النظام:</Text>

          {/* Portal Cards */}
          <View style={styles.portalCardsContainer}>
            <TouchableOpacity 
              style={[styles.portalCard, styles.doctorCard]} 
              onPress={() => updateStep('specialty')}
              activeOpacity={0.8}
            >
              <View style={styles.portalHeaderRow}>
                <Text style={styles.portalIcon}>🩺</Text>
                <Text style={styles.badgeTagDoc}>SPECIALIST</Text>
              </View>
              <Text style={styles.portalTitle}>بوابة الطبيب</Text>
              <Text style={styles.portalDesc}>إدارة المرضى، الاستشارات الإكلينيكية الذكية بـ LLaMA AI، وإصدار الروشتات المعتمدة</Text>
              <View style={styles.cardActionRow}>
                <Text style={styles.actionText}>الدخول للوحة التحكم ←</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.portalCard, styles.patientCard]} 
              onPress={() => updateStep('patient')}
              activeOpacity={0.8}
            >
              <View style={styles.portalHeaderRow}>
                <Text style={styles.portalIcon}>👤</Text>
                <Text style={styles.badgeTagPat}>PATIENT PORTAL</Text>
              </View>
              <Text style={styles.portalTitle}>بوابة المريض</Text>
              <Text style={styles.portalDesc}>متابعة السجل الطبي، معاينة وتكبير صور الأشعة بدقة عالية Ultra Zoom، الروشتات والمواعيد</Text>
              <View style={styles.cardActionRow}>
                <Text style={styles.actionTextPatient}>استعراض الملف الطبي ←</Text>
              </View>
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
                activeOpacity={0.7}
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
            onUpdateSpecialty={(newSpec) => updateSpecialty(newSpec)}
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
  container: { flex: 1, backgroundColor: '#060911', paddingTop: Platform.OS === 'web' ? 0 : 0 },
  topBar: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#0F172A', paddingHorizontal: 15, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1E293B'
  },
  backButton: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  backButtonText: { color: '#00F2FE', fontSize: 13, fontWeight: 'bold' },
  specialtyBadge: { color: '#FFFFFF', backgroundColor: '#0284C7', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  
  landingContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  headerGlowBox: { alignItems: 'center', marginTop: 20, marginBottom: 25 },
  mainTitle: { 
    fontSize: 32, 
    fontWeight: '900', 
    color: '#00F2FE', 
    textAlign: 'center', 
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 242, 254, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 6, gap: 6 },
  brandTag: { fontSize: 10, color: '#64748B', fontWeight: 'bold', letterSpacing: 1 },
  brandSubtitle: { 
    fontSize: 14, 
    fontWeight: '900', 
    color: '#38BDF8', 
    letterSpacing: 2.5, 
    textShadowColor: 'rgba(56, 189, 248, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10 
  },
  subTitle: { fontSize: 14, color: '#94A3B8', marginTop: 4, textAlign: 'center', fontWeight: '600' },
  selectPrompt: { fontSize: 16, color: '#F8FAFC', marginBottom: 20, fontWeight: '700' },
  
  portalCardsContainer: { width: '100%', maxWidth: 480, gap: 18 },
  portalCard: { 
    padding: 22, 
    borderRadius: 18, 
    borderWidth: 1, 
    borderColor: '#1E293B',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
  },
  doctorCard: { 
    backgroundColor: '#0F172A',
    borderRightWidth: 4,
    borderRightColor: '#00F2FE'
  },
  patientCard: { 
    backgroundColor: '#0B132B',
    borderRightWidth: 4,
    borderRightColor: '#38BDF8'
  },
  portalHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  portalIcon: { fontSize: 36 },
  badgeTagDoc: { backgroundColor: 'rgba(0, 242, 254, 0.12)', color: '#00F2FE', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#00F2FE' },
  badgeTagPat: { backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#38BDF8' },
  portalTitle: { fontSize: 21, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 6, textAlign: 'right' },
  portalDesc: { fontSize: 12.5, color: '#94A3B8', textAlign: 'right', lineHeight: 20, marginBottom: 15 },
  
  cardActionRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10, alignItems: 'flex-start' },
  actionText: { color: '#00F2FE', fontSize: 12, fontWeight: 'bold' },
  actionTextPatient: { color: '#38BDF8', fontSize: 12, fontWeight: 'bold' },

  specialtyContainer: { padding: 20, alignItems: 'center' },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginTop: 15 },
  sectionSub: { fontSize: 13, color: '#94A3B8', marginBottom: 20, textAlign: 'center' },
  grid: { width: '100%', maxWidth: 480, gap: 10 },
  specialtyCard: { backgroundColor: '#0F172A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', alignItems: 'center' },
  specialtyText: { color: '#F8FAFC', fontSize: 14, fontWeight: 'bold' },
  body: { flex: 1 }
});
 
