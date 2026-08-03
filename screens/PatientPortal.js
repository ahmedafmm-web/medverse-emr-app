import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, ScrollView, 
  TouchableOpacity, ActivityIndicator, Platform, Image, Linking 
} from 'react-native';
import { supabase } from '../supabaseClient';
import { generatePrescriptionPDF } from '../components/PDFGenerator';

export default function PatientPortal({ onBackToDashboard, doctorClinicId }) {
  const [patientCode, setPatientCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [doctorInfo, setDoctorInfo] = useState(null);

  // حالة شريط تقدم تنزيل كل صورة أشعة على حدة
  const [downloadProgressMap, setDownloadProgressMap] = useState({});

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      alert(`${title}: ${message}`);
    }
  };

  useEffect(() => {
    let cId = doctorClinicId;
    if (!cId && Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      cId = urlParams.get('c');
    }

    if (cId) {
      fetchClinicHeader(cId);
    }
  }, [doctorClinicId]);

  const fetchClinicHeader = async (identifier) => {
    try {
      let query = supabase
        .from('clinics')
        .select('doctor_name, clinic_name, specialty, logo_url, stamp_url, phone, address, email');

      query = query.or(`id.eq.${identifier},user_id.eq.${identifier}`);

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
        showAlert('تنبيه', 'لم يتم العثور على مريض بهذا الرقم الفريد في قاعدة بيانات هذه العيادة.');
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

      if (!doctorInfo && patient.doctor_email) {
        const { data: cData } = await supabase
          .from('clinics')
          .select('doctor_name, clinic_name, specialty, logo_url, stamp_url, phone, address')
          .ilike('email', patient.doctor_email)
          .limit(1)
          .maybeSingle();

        if (cData) {
          setDoctorInfo(cData);
        }
      }

    } catch (error) {
      console.error('Fetch Patient Records Error:', error);
      showAlert('خطأ في التحميل', error.message || error);
    } finally {
      setLoading(false);
    }
  };

  // --- دالة تنزيل صورة الأشعة المنفصلة عالية الدقة مع شريط التقدم ---
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

  // --- نسخ رابط المشاركة المؤقت للاستشاريين وإصلاح مسار 404 ---
  const handleCopyTemporaryShareLink = () => {
    if (!patientData?.patient_code) return;
    const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin.split('?')[0] : 'https://medverse-emr-suite.vercel.app';
    const shareUrl = `${baseUrl}?c=${patientData.patient_code}`;

    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      showAlert('تم نسخ رابط المشاركة 📋', `يمكنك إرسال هذا الرابط للأطباء أو المعامل لمعاينة ملفك:\n${shareUrl}`);
    } else {
      showAlert('رابط ملفك الطبي', shareUrl);
    }
  };

  const handleDownloadPDF = async (record) => {
    try {
      const fields = record.dynamic_fields || {};
      const medsList = fields.medications || record.prescriptions || record.medications || [];

      const clinicInfo = {
        doctorName: doctorInfo?.doctor_name || 'د. أحمد محمد',
        clinicName: doctorInfo?.clinic_name || 'عيادة MedVerse التخصصية',
        specialty: doctorInfo?.specialty || 'استشاري أمراض القلب والباطنة',
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
      console.error('PDF Generation Error:', err);
      showAlert('خطأ', 'حدث خطأ أثناء إعداد الروشتة للطباعة.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* --- Dynamic Doctor/Clinic Header --- */}
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
            placeholder="مثال: PAT-65630"
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
              const fields = item.dynamic_fields || {};
              const scansList = fields.scans_list || (fields.scanUrl ? [{ url: fields.scanUrl, title: fields.scanTitle || 'أشعة طبية' }] : []);

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

                  {/* قائمة صور الأشعة المرفوعة منفصلة مع زِر تنزيل وشريط تقدم مستقل لكل صورة */}
                  {scansList.length > 0 && (
                    <View style={styles.scansContainer}>
                      <Text style={styles.scansHeaderTitle}>🖼️ مرفقات صور الأشعة المرفوعة ({scansList.length}):</Text>
                      
                      {scansList.map((scanItem, sIdx) => {
                        const progress = downloadProgressMap[scanItem.url];

                        return (
                          <View key={sIdx} style={styles.scanItemCard}>
                            <Image source={{ uri: scanItem.url }} style={styles.scanImage} resizeMode="contain" />
                            <Text style={styles.scanTitle}>{scanItem.title || 'صورة أشعة عالية الدقة'}</Text>

                            {/* شريط تقدم التحميل المباشر أسفل الصورة */}
                            {progress !== undefined && progress !== null && (
                              <View style={styles.downloadProgressBarBox}>
                                <View style={[styles.downloadProgressBarFill, { width: `${progress}%` }]} />
                                <Text style={styles.downloadProgressText}>جاري التنزيل... {progress}%</Text>
                              </View>
                            )}

                            <TouchableOpacity
                              style={styles.downloadScanBtn}
                              onPress={() => handleDownloadSingleScan(scanItem.url, scanItem.title)}
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
  scanImage: { width: '100%', height: 220, borderRadius: 6, backgroundColor: '#000' },
  scanTitle: { fontSize: 12, fontWeight: 'bold', color: '#F8FAFC', marginTop: 6, textAlign: 'center' },

  downloadScanBtn: { backgroundColor: '#10B981', padding: 10, borderRadius: 6, width: '100%', alignItems: 'center', marginTop: 8 },
  downloadScanBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 11 },

  downloadProgressBarBox: { width: '100%', height: 16, backgroundColor: '#090D16', borderRadius: 8, overflow: 'hidden', marginTop: 8, justifyContent: 'center', borderWidth: 1, borderColor: '#1E293B' },
  downloadProgressBarFill: { height: '100%', backgroundColor: '#0284C7', position: 'absolute' },
  downloadProgressText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', textAlign: 'center', zIndex: 1 },

  downloadPdfBtn: { backgroundColor: '#0284C7', padding: 12, borderRadius: 8, alignItems: 'center' },
  downloadPdfBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  emptyBox: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#64748B', fontSize: 13 }
});
 
