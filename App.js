import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
  ActivityIndicator
} from 'react-native';
import DoctorDashboard from './screens/DoctorDashboard';
import PatientPortal from './screens/PatientPortal';
import { supabase } from './supabaseClient';

// --- معالجة وتحسين دقة وتباين الصور على الهاتف قبل إرسالها للكمبيوتر ---
const enhanceMobileScanImage = (file, maxWidth = 2800, quality = 0.95) => {
  return new Promise((resolve) => {
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new window.Image();
      img.src = objectUrl;
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else if (width < 1400) {
          const scale = Math.min(1800 / width, 1.5);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (typeof ctx.filter !== 'undefined') {
          ctx.filter = 'contrast(1.18) brightness(1.04) saturate(1.05)';
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            const finalBlob = blob || file;
            resolve({
              blob: finalBlob,
              previewUrl: URL.createObjectURL(finalBlob)
            });
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ blob: file, previewUrl: URL.createObjectURL(file) });
      };
    } catch (e) {
      resolve({ blob: file, previewUrl: URL.createObjectURL(file) });
    }
  });
};

// --- واجهة الماسح السريع للهاتف المرتبطة بجلسة الطبيب عبر QR Code ---
function MobileScannerBridge({ sessionId }) {
  const [uploading, setUploading] = useState(false);
  const [sentPhotos, setSentPhotos] = useState([]);
  const [statusMessage, setStatusMessage] = useState('جاهز لالتقاط أو اختيار صور التحاليل والأشعة وإرسالها فوراً لشاشة الطبيب');

  const handleCaptureOrPickFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setStatusMessage(`جاري رفع وتحسين دقة (${files.length}) صورة وإرسالها للكمبيوتر...`);

    try {
      const newlyUploaded = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const enhanced = await enhanceMobileScanImage(file, 2800, 0.95);
        const timestamp = Date.now();
        const uniqueId = Math.random().toString(36).substring(2, 8);
        const filePath = `qr_sessions/${sessionId}/${timestamp}_${uniqueId}_${i}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from('clinic-assets')
          .upload(filePath, enhanced.blob, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadErr) {
          throw new Error(uploadErr.message || 'فشل رفع الصورة للسحابة');
        }

        const { data: urlData } = supabase.storage
          .from('clinic-assets')
          .getPublicUrl(filePath);

        const publicUrl =
          urlData?.publicUrl ||
          `https://emynlqikbdwogijqfbfw.supabase.co/storage/v1/object/public/clinic-assets/${filePath}`;

        newlyUploaded.push({
          id: `${timestamp}_${uniqueId}_${i}`,
          url: publicUrl,
          title: file.name ? file.name.replace(/\.[^/.]+$/, '') : `صورة من الهاتف ${sentPhotos.length + i + 1}`,
          createdAt: new Date().toISOString()
        });
      }

      const updatedAll = [...sentPhotos, ...newlyUploaded];
      setSentPhotos(updatedAll);

      // تحديث ملف الجلسة اللحظي (manifest.json) ليلتقطه اللابتوب في أقل من ثانية
      const manifestBlob = new Blob([JSON.stringify({ sessionId, items: updatedAll, updatedAt: Date.now() })], {
        type: 'application/json'
      });

      await supabase.storage
        .from('clinic-assets')
        .upload(`qr_sessions/${sessionId}/manifest.json`, manifestBlob, {
          contentType: 'application/json',
          upsert: true
        });

      setStatusMessage(`✅ تم إرسال (${newlyUploaded.length}) صورة بنجاح! ظهرت الآن على شاشة الطبيب. يمكنك تصوير المزيد...`);
    } catch (err) {
      setStatusMessage(`❌ خطأ أثناء الإرسال: ${err.message}`);
    } finally {
      setUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  return (
    <ScrollView contentContainerStyle={scannerStyles.container}>
      <View style={scannerStyles.card}>
        <Text style={scannerStyles.badge}>📱 LIVE QR CAMERA BRIDGE</Text>
        <Text style={scannerStyles.title}>ماسح التحاليل والأشعة السريع</Text>
        <Text style={scannerStyles.sessionCode}>كود الجلسة المتصلة: {sessionId}</Text>

        <View style={scannerStyles.statusBox}>
          <Text style={scannerStyles.statusText}>{statusMessage}</Text>
        </View>

        {uploading ? (
          <View style={{ marginVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#00F2FE" />
            <Text style={{ color: '#00F2FE', marginTop: 10, fontWeight: 'bold', fontSize: 13 }}>
              جاري المعالجة فائقة الدقة والبث المباشر...
            </Text>
          </View>
        ) : (
          <View style={scannerStyles.buttonsColumn}>
            {Platform.OS === 'web' && (
              <>
                <label style={scannerStyles.cameraBtnLabel}>
                  📸 تصوير بالكاميرا الآن (إرسال فوري)
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCaptureOrPickFiles}
                    style={{ display: 'none' }}
                  />
                </label>

                <label style={scannerStyles.galleryBtnLabel}>
                  🖼️ اختيار عدة صور من الاستوديو
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleCaptureOrPickFiles}
                    style={{ display: 'none' }}
                  />
                </label>
              </>
            )}
          </View>
        )}

        {sentPhotos.length > 0 && (
          <View style={scannerStyles.sentSection}>
            <Text style={scannerStyles.sentHeader}>
              ✅ الصور المرسلة للكمبيوتر في هذه الجلسة ({sentPhotos.length}):
            </Text>
            <View style={scannerStyles.thumbsGrid}>
              {sentPhotos.map((item, idx) => (
                <View key={item.id} style={scannerStyles.thumbCard}>
                  {Platform.OS === 'web' && (
                    <img
                      src={item.url}
                      alt={item.title}
                      style={{ width: '100%', height: '85px', borderRadius: '6px', objectFit: 'cover' }}
                    />
                  )}
                  <Text style={scannerStyles.thumbLabel} numberOfLines={1}>
                    #{idx + 1} تم الإرسال ✓
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={scannerStyles.footerNote}>
          💡 تظل هذه الصفحة متصلة ومفتوحة لتتمكن من تصوير باقي الأوراق والأشعة تباعاً حتى تنتهي على شاشة الكمبيوتر.
        </Text>
      </View>
    </ScrollView>
  );
}

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
  const [qrScanSessionId, setQrScanSessionId] = useState(null);

  const specialties = [
    { id: 'internal', name: '🩺 الطب الباطني والأمراض المزمنة' },
    { id: 'rheumatology', name: '🩺 أمراض الروماتيزم والروماتويد والأمراض المناعية' },
    { id: 'pediatrics', name: '👶 طب الأطفال وحديثي الولادة' },
    { id: 'cardiology', name: '❤️ أمراض القلب والأوعية الدموية' },
    { id: 'surgery', name: '🔪 الجراحة العامة' },
    { id: 'orthopedics', name: '🦴 جراحة العظام والمفاصل' },
    { id: 'dermatology', name: '✨ الجلدية والتجميل' },
  ];

  // 2. معالجة روابط الـ URL الخارجية المباشرة (جلسة QR كاميرا الهاتف أو روابط العيادة/المريض)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const scanSessionParam = urlParams.get('scan_session');
      if (scanSessionParam) {
        setQrScanSessionId(scanSessionParam);
        return;
      }

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
    setQrScanSessionId(null);
    updateStep('landing');

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('medverse_current_step');
      localStorage.removeItem('medverse_selected_specialty');
      localStorage.removeItem('medverse_doctor_active_tab');
    }
  };

  // إذا فُتح الرابط من الهاتف عبر مسح QR Code الجلسة، نعرض شاشة الماسح السريع مباشرة
  if (qrScanSessionId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#060911" />
        <MobileScannerBridge sessionId={qrScanSessionId} />
      </SafeAreaView>
    );
  }

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

const scannerStyles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '90%'
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#0284C7',
    alignItems: 'center'
  },
  badge: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00F2FE',
    marginBottom: 10
  },
  title: {
    fontSize: 21,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4
  },
  sessionCode: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: 'bold',
    marginBottom: 14
  },
  statusBox: {
    width: '100%',
    backgroundColor: '#060911',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600'
  },
  buttonsColumn: {
    width: '100%',
    gap: 12
  },
  cameraBtnLabel: {
    backgroundColor: '#047857',
    color: '#FFFFFF',
    padding: '16px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 'bold',
    textAlign: 'center',
    cursor: 'pointer',
    border: '2px solid #10B981',
    display: 'block'
  },
  galleryBtnLabel: {
    backgroundColor: '#0284C7',
    color: '#FFFFFF',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 'bold',
    textAlign: 'center',
    cursor: 'pointer',
    border: '1px solid #00F2FE',
    display: 'block'
  },
  sentSection: {
    width: '100%',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E293B'
  },
  sentHeader: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 10
  },
  thumbsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8
  },
  thumbCard: {
    width: '31%',
    backgroundColor: '#060911',
    padding: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center'
  },
  thumbLabel: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4
  },
  footerNote: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18
  }
});

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
