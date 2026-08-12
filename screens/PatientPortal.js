import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, ScrollView, 
  TouchableOpacity, ActivityIndicator, Platform, Image, Linking, Modal 
} from 'react-native';
import { supabase } from '../supabaseClient';
import { generatePrescriptionPDF } from '../components/PDFGenerator';

export default function PatientPortal({ onBackToDashboard, doctorClinicId, initialPatientCode }) {
  const [patientCode, setPatientCode] = useState(initialPatientCode || '');
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [downloadProgressMap, setDownloadProgressMap] = useState({});

  // حالات المعاينة والتكبير الفائق للأشعة (Lightbox & Zoom) للمريض
  const [viewingScanModal, setViewingScanModal] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      alert(`${title}: ${message}`);
    }
  };

  useEffect(() => {
    let cId = doctorClinicId;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryCode = urlParams.get('c') || urlParams.get('clinic') || urlParams.get('patient');
      if (queryCode) {
        cId = queryCode;
        if (queryCode.startsWith('PAT-')) {
          setPatientCode(queryCode);
          handleFetchRecords(queryCode);
        } else {
          fetchClinicHeader(queryCode);
        }
      }
    } else if (cId) {
      fetchClinicHeader(cId);
    }

    if (initialPatientCode) {
      handleFetchRecords(initialPatientCode);
    }
  }, [doctorClinicId, initialPatientCode]);

  // دالة جلب هيدر العيادة المحدثة لتقبل المعرف بكافة أشكاله (id, email, user_id)
  const fetchClinicHeader = async (identifier) => {
    if (!identifier) return;
    try {
      let query = supabase
        .from('clinics')
        .select('doctor_name, clinic_name, specialty, logo_url, stamp_url, phone, address, email');

      if (identifier.includes('@')) {
        query = query.ilike('email', identifier.toLowerCase());
      } else {
        query = query.or(`id.eq.${identifier},user_id.eq.${identifier}`);
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (!error && data) {
        setDoctorInfo(data);
      }
    } catch (err) {
      console.error('Fetch Clinic Header Error:', err);
    }
  };

  const handleFetchRecords = async (codeToSearch = null) => {
    const targetCode = (codeToSearch || patientCode).trim().toUpperCase();
    if (!targetCode) {
      showAlert('تنبيه', 'يرجى إدخال كود المريض الفريد (Patient ID).');
      return;
    }

    setLoading(true);
    try {
      let { data: patient, error: pErr } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_code', targetCode)
        .maybeSingle();

      if (pErr || !patient) {
        showAlert('تنبيه', 'لم يتم العثور على مريض بهذا الرقم الفريد.');
        setPatientData(null);
        setMedicalRecords([]);
        return;
      }

      setPatientData(patient);

      const { data: records, error: rErr } = await supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (rErr) throw rErr;
      setMedicalRecords(records || []);

      if (!doctorInfo) {
        let clinicQuery = supabase.from('clinics').select('doctor_name, clinic_name, specialty, logo_url, stamp_url, phone, address');
        if (patient.doctor_email) {
          clinicQuery = clinicQuery.ilike('email', patient.doctor_email);
        } else if (patient.clinic_id) {
          clinicQuery = clinicQuery.eq('id', patient.clinic_id);
        }
        const { data: cData } = await clinicQuery.limit(1).maybeSingle();

        if (cData) setDoctorInfo(cData);
      }

    } catch (error) {
      console.error('Fetch Patient Records Error:', error);
      showAlert('خطأ في التحميل', error.message || error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSingleScan = async (scanUrl, scanTitle) => {
    if (!scanUrl) return;
    setDownloadProgressMap(prev => ({ ...prev, [scanUrl]: 15 }));

    try {
      setDownloadProgressMap(prev => ({ ...prev, [scanUrl]: 45 }));
      const response = await fetch(scanUrl);
      const blob = await response.blob();
      setDownloadProgressMap(prev => ({ ...prev, [scanUrl]: 85 }));

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${scanTitle || 'Medical_Scan'}_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        Linking.openURL(scanUrl);
      }

      setDownloadProgressMap(prev => ({ ...prev, [scanUrl]: 100 }));
      setTimeout(() => {
        setDownloadProgressMap(prev => ({ ...prev, [scanUrl]: null }));
      }, 1500);

    } catch (err) {
      showAlert('خطأ التنزيل', 'تعذر تنزيل الصورة مباشرة: ' + err.message);
      setDownloadProgressMap(prev => ({ ...prev, [scanUrl]: null }));
    }
  };

  const handleCopyTemporaryShareLink = () => {
    if (!patientData?.patient_code) return;
    const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin.split('?')[0] : 'https://medverse-emr-suite.vercel.app';
    const shareUrl = `${baseUrl}?c=${patientData.patient_code}`;

    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      showAlert('تم نسخ رابط المشاركة 📋', shareUrl);
    } else {
      showAlert('رابط ملفك الطبي', shareUrl);
    }
  };

  const handleDownloadPDF = async (record) => {
    try {
      const fields = record.dynamic_fields || {};
      const medsList = fields.medications || record.prescriptions || record.medications || [];

      const clinicInfo = {
        doctorName: doctorInfo?.doctor_name || 'د. حسام المنفلوطي',
        clinicName: doctorInfo?.clinic_name || 'عياده المنفلوطي',
        specialty: doctorInfo?.specialty || 'استشاري أمراض الروماتيزم والروماتويد والأمراض المناعية',
        logoUrl: doctorInfo?.logo_url || '',
        stampUrl: doctorInfo?.stamp_url || '',
        phone: doctorInfo?.phone || '',
        address: doctorInfo?.address || ''
      };

      await generatePrescriptionPDF(
        { name: patientData?.full_name || '', phone: patientData?.phone || '', code: patientData?.patient_code || '' },
        record.diagnosis || '',
        {
          'السن والنوع': `${fields.age || 'غير محدد'} سنة (${fields.gender || 'غير محدد'})`,
          'الأمراض المزمنة': fields.chronicDiseases || 'لا يوجد',
          'ملاحظات الفحوصات والأشعة': fields.doctorNotes || 'لا يوجد'
        },
        medsList,
        clinicInfo
      );
    } catch (err) {
      showAlert('خطأ', 'حدث خطأ أثناء إعداد الروشتة للطباعة.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Lightbox Ultra-Zoom Modal لمعاينة الأشعة بدقة فائقة للمريض */}
      <Modal visible={!!viewingScanModal} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity 
            style={styles.lightboxCloseBtn} 
            onPress={() => { setViewingScanModal(null); setZoomScale(1); }}
          >
            <Text style={styles.lightboxCloseText}>إغلاق ✕</Text>
          </TouchableOpacity>

          <View style={styles.lightboxControls}>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomScale(z => Math.min(z + 0.8, 5))}>
              <Text style={styles.zoomBtnText}>🔍 تكبير عالي (+)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomScale(1)}>
              <Text style={styles.zoomBtnText}>🔄 إعادة (1x)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomScale(z => Math.max(z - 0.4, 0.5))}>
              <Text style={styles.zoomBtnText}>🔍 تصغير (-)</Text>
            </TouchableOpacity>
          </View>

          {viewingScanModal && (
            <ScrollView 
              contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', flexGrow: 1 }} 
              maximumZoomScale={5} 
              minimumZoomScale={0.5}
            >
              {Platform.OS === 'web' ? (
                <img 
                  src={viewingScanModal.url} 
                  alt={viewingScanModal.title} 
                  style={{ width: 340 * zoomScale, height: 340 * zoomScale, borderRadius: '8px', objectFit: 'contain' }} 
                />
              ) : (
                <Image 
                  source={{ uri: viewingScanModal.url }} 
                  style={{ width: 340 * zoomScale, height: 340 * zoomScale, borderRadius: 8, resizeMode: 'contain' }} 
                />
              )}
              <Text style={styles.lightboxTitle}>{viewingScanModal.title}</Text>
            </ScrollView>
          )}
        </View>
      </Modal>

      <View style={styles.header}>
        {doctorInfo?.logo_url ? (
          <Image source={{ uri: doctorInfo.logo_url }} style={styles.headerLogo} resizeMode="contain" />
        ) : null}
        <Text style={styles.title}>{doctorInfo?.clinic_name || 'MedVerse Patient Portal'}</Text>
        <Text style={styles.doctorSub}>
          {doctorInfo?.doctor_name ? `${doctorInfo.doctor_name} - ${doctorInfo.specialty}` : 'بوابة استعراض السجلات والروشتات والأشعات الطبية المعتمدة'}
        </Text>
      </View>

      {!patientData ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔐 الدخول برقم المريض الفريد</Text>
          <Text style={styles.label}>أدخل كود المريض الخاص بك (Patient ID):</Text>
          <TextInput
            style={styles.input}
            placeholder="مثال: PAT-83207"
            placeholderTextColor="#64748B"
            value={patientCode}
            onChangeText={setPatientCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={() => handleFetchRecords()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>عرض التقارير والروشتات والأشعة 🚀</Text>
            )}
          </TouchableOpacity>

          {onBackToDashboard && (
            <TouchableOpacity style={styles.backBtn} onPress={onBackToDashboard}>
              <Text style={styles.backBtnText}>← العودة للوحة التحكم الرئيسية</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={{ marginBottom: 30 }}>
          <View style={styles.patientCard}>
            <View style={styles.row}>
              <Text style={styles.patientName}>👤 المريض: {patientData.full_name}</Text>
              <TouchableOpacity onPress={() => setPatientData(null)}>
                <Text style={styles.logoutText}>خروج ✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.patientCodeText}>Patient ID: {patientData.patient_code}</Text>

            <TouchableOpacity style={styles.sharePassBtn} onPress={handleCopyTemporaryShareLink}>
              <Text style={styles.sharePassBtnText}>🔗 نسخ رابط مشاركة الملف الطبي مع الأطباء</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitleHeader}>📋 السجلات المعتمدة والأشعات ({medicalRecords.length})</Text>

          {medicalRecords.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>لا توجد تقارير أو أشعات معتمدة متاحة حالياً لهذا الكود.</Text>
            </View>
          ) : (
            medicalRecords.map((item, idx) => {
              let df = item.dynamic_fields;
              if (typeof df === 'string') {
                try { df = JSON.parse(df); } catch (e) { df = {}; }
              } else {
                df = df || {};
              }

              const scansList = df.scans_list || (df.scanUrl ? [{ url: df.scanUrl, title: df.scanTitle || 'أشعة طبية' }] : []);

              return (
                <View key={item.id || idx} style={styles.recordCard}>
                  <View style={styles.row}>
                    <Text style={styles.recordDate}>
                      📅 زيارة بتاريخ: {new Date(item.created_at || item.visit_date || Date.now()).toLocaleDateString('ar-EG')}
                    </Text>
                    <Text style={styles.verifiedBadge}>✓ معتمد</Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.recordLabel}>التشخيص المعتمد / عنوان الفحص:</Text>
                  <Text style={styles.recordValue}>{item.diagnosis || 'لا يوجد تشخيص مدون'}</Text>

                  {scansList.length > 0 && (
                    <View style={styles.scansContainer}>
                      <Text style={styles.scansHeaderTitle}>🖼️ مرفقات صور الأشعة المرفوعة ({scansList.length}):</Text>
                      
                      {scansList.map((scanItem, sIdx) => {
                        const scanUrl = scanItem.url || scanItem.publicUrl || scanItem.publicURL;
                        const progress = downloadProgressMap[scanUrl];

                        return (
                          <View key={sIdx} style={styles.scanItemCard}>
                            <TouchableOpacity onPress={() => { setViewingScanModal({ ...scanItem, url: scanUrl }); setZoomScale(1); }}>
                              {Platform.OS === 'web' ? (
                                <img 
                                  src={scanUrl} 
                                  alt={scanItem.title || 'صورة أشعة'} 
                                  style={{ width: '100%', height: '220px', borderRadius: '6px', objectFit: 'cover', backgroundColor: '#1E293B' }} 
                                />
                              ) : (
                                <Image source={{ uri: scanUrl }} style={styles.scanImage} resizeMode="cover" />
                              )}
                            </TouchableOpacity>
                            
                            <Text style={styles.scanTitle}>{scanItem.title || 'صورة أشعة عالية الدقة'}</Text>

                            <TouchableOpacity 
                              style={styles.previewBtn}
                              onPress={() => { setViewingScanModal({ ...scanItem, url: scanUrl }); setZoomScale(1); }}
                            >
                              <Text style={styles.previewBtnText}>🔍 معاينة وتكبير الأشعة (Ultra Zoom)</Text>
                            </TouchableOpacity>

                            {progress !== undefined && progress !== null && (
                              <View style={styles.downloadProgressBarBox}>
                                <View style={[styles.downloadProgressBarFill, { width: `${progress}%` }]} />
                                <Text style={styles.downloadProgressText}>جاري التنزيل... {progress}%</Text>
                              </View>
                            )}

                            <TouchableOpacity
                              style={styles.downloadScanBtn}
                              onPress={() => handleDownloadSingleScan(scanUrl, scanItem.title)}
                            >
                              <Text style={styles.downloadScanBtnText}>⬇️ تنزيل الأشعة بجودة عالية (High-Res Image)</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.downloadPdfBtn}
                    onPress={() => handleDownloadPDF(item)}
                  >
                    <Text style={styles.downloadPdfBtnText}>🖨️ فتح وتنزيل الروشتة المعتمدة (PDF)</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D16', padding: 14 },
  header: { marginBottom: 20, alignItems: 'center', marginTop: 15 },
  headerLogo: { width: 70, height: 70, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: '#00F2FE', textAlign: 'center', letterSpacing: 0.5 },
  doctorSub: { fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#131C2E', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1E293B' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 15, textAlign: 'right' },
  sectionTitleHeader: { fontSize: 15, fontWeight: 'bold', color: '#F8FAFC', marginVertical: 15, textAlign: 'right' },
  label: { fontSize: 13, color: '#CBD5E1', marginBottom: 8, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#1E293B', borderRadius: 10, padding: 12, backgroundColor: '#090D16', color: '#FFFFFF', fontSize: 15, textAlign: 'center', marginBottom: 15 },
  btn: { backgroundColor: '#0284C7', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  backBtn: { marginTop: 18, alignItems: 'center', padding: 6 },
  backBtnText: { color: '#00F2FE', fontSize: 13, fontWeight: 'bold' },
  patientCard: { backgroundColor: '#131C2E', padding: 16, borderRadius: 12, borderRightWidth: 4, borderRightColor: '#00F2FE', marginBottom: 10, borderWidth: 1, borderColor: '#1E293B' },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  patientName: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
  logoutText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
  patientCodeText: { color: '#00F2FE', fontSize: 12, marginTop: 4, textAlign: 'right', fontFamily: 'monospace' },
  sharePassBtn: { backgroundColor: '#0284C7', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center' },
  sharePassBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  recordCard: { backgroundColor: '#131C2E', padding: 16, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#1E293B' },
  recordDate: { fontSize: 12, color: '#94A3B8' },
  verifiedBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10B981', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#10B981' },
  divider: { height: 1, backgroundColor: '#1E293B', marginVertical: 10 },
  recordLabel: { fontSize: 12, color: '#94A3B8', textAlign: 'right', marginBottom: 4 },
  recordValue: { fontSize: 14, color: '#F8FAFC', textAlign: 'right', marginBottom: 12 },
  scansContainer: { backgroundColor: '#090D16', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#1E293B' },
  scansHeaderTitle: { fontSize: 12, fontWeight: 'bold', color: '#00F2FE', marginBottom: 10, textAlign: 'right' },
  scanItemCard: { backgroundColor: '#131C2E', padding: 10, borderRadius: 8, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  scanImage: { width: '100%', height: 220, borderRadius: 6, backgroundColor: '#1E293B' },
  scanTitle: { fontSize: 12, fontWeight: 'bold', color: '#F8FAFC', marginTop: 6, textAlign: 'center' },
  previewBtn: { backgroundColor: '#1E293B', padding: 8, borderRadius: 6, width: '100%', alignItems: 'center', marginTop: 6, borderWidth: 1, borderColor: '#0284C7' },
  previewBtnText: { color: '#00F2FE', fontSize: 11, fontWeight: 'bold' },
  downloadScanBtn: { backgroundColor: '#10B981', padding: 10, borderRadius: 6, width: '100%', alignItems: 'center', marginTop: 8 },
  downloadScanBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 11 },
  downloadProgressBarBox: { width: '100%', height: 16, backgroundColor: '#090D16', borderRadius: 8, overflow: 'hidden', marginTop: 8, justifyContent: 'center', borderWidth: 1, borderColor: '#1E293B' },
  downloadProgressBarFill: { height: '100%', backgroundColor: '#0284C7', position: 'absolute' },
  downloadProgressText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', textAlign: 'center', zIndex: 1 },
  downloadPdfBtn: { backgroundColor: '#0284C7', padding: 12, borderRadius: 8, alignItems: 'center' },
  downloadPdfBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  emptyBox: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#64748B', fontSize: 13 },
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  lightboxCloseBtn: { position: 'absolute', top: 20, right: 20, backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, zIndex: 10 },
  lightboxCloseText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  lightboxControls: { position: 'absolute', bottom: 30, flexDirection: 'row-reverse', gap: 10, zIndex: 10 },
  zoomBtn: { backgroundColor: '#0284C7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  zoomBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  lightboxTitle: { color: '#00F2FE', fontSize: 13, fontWeight: 'bold', marginTop: 12, textAlign: 'center' }
});
