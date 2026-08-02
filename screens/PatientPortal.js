import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Image } from 'react-native';
import { supabase } from '../supabaseClient';
import { generatePrescriptionPDF } from '../components/PDFGenerator';

export default function PatientPortal({ onBackToDashboard, doctorClinicId }) {
  const [patientCode, setPatientCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [doctorInfo, setDoctorInfo] = useState(null);

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      alert(`${title}: ${message}`);
    }
  };

  useEffect(() => {
    if (doctorClinicId) {
      fetchClinicHeader(doctorClinicId);
    }
  }, [doctorClinicId]);

  const fetchClinicHeader = async (clinicId) => {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('doctor_name, clinic_name, specialty, logo_url, phone, address')
        .eq('id', clinicId)
        .single();

      if (!error && data) {
        setDoctorInfo(data);
      }
    } catch (err) {
      console.error('Fetch Clinic Header Error:', err);
    }
  };

  const handleFetchRecords = async () => {
    if (!patientCode.trim()) {
      showAlert('تنبيه', 'يرجى إدخال كود المريض الفريد (Patient ID).');
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('patients')
        .select('*')
        .eq('patient_code', patientCode.trim().toUpperCase());

      if (doctorClinicId) {
        query = query.eq('clinic_id', doctorClinicId);
      }

      const { data: patient, error: pErr } = await query.single();

      if (pErr || !patient) {
        showAlert('تنبيه', 'لم يتم العثور على مريض بهذا الرقم الفريد في قاعدة بيانات هذه العيادة.');
        setPatientData(null);
        setMedicalRecords([]);
        return;
      }

      setPatientData(patient);

      const { data: records, error: rErr } = await supabase
        .from('medical_records')
        .select(`
          *,
          clinics (
            doctor_name,
            clinic_name,
            specialty,
            logo_url,
            stamp_url,
            phone,
            address
          )
        `)
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (rErr) throw rErr;

      setMedicalRecords(records || []);

      if (records && records.length > 0 && records[0].clinics) {
        setDoctorInfo(records[0].clinics);
      }

    } catch (error) {
      console.error('Fetch Patient Records Error:', error);
      showAlert('خطأ في التحميل', error.message || error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (record) => {
    try {
      const fields = record.dynamic_fields || {};
      const medsList = fields.medications || record.prescriptions || record.medications || [];

      const clinicInfo = {
        doctorName: record.clinics?.doctor_name || doctorInfo?.doctor_name || 'د. أحمد محمد',
        clinicName: record.clinics?.clinic_name || doctorInfo?.clinic_name || 'عيادة MedVerse التخصصية',
        specialty: record.clinics?.specialty || doctorInfo?.specialty || 'استشاري أمراض القلب والباطنة',
        logoUrl: record.clinics?.logo_url || doctorInfo?.logo_url || '',
        stampUrl: record.clinics?.stamp_url || '',
        phone: record.clinics?.phone || doctorInfo?.phone || '',
        address: record.clinics?.address || doctorInfo?.address || ''
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
        <Text style={styles.doctorSub}>{doctorInfo?.doctor_name ? `${doctorInfo.doctor_name} - ${doctorInfo.specialty}` : 'بوابة استعراض السجلات والروشتات الطبية المعتمدة'}</Text>
      </View>

      {!patientData ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔐 الدخول برقم المريض الفريد</Text>
          <Text style={styles.label}>أدخل كود المريض الخاص بك (Patient ID):</Text>
          <TextInput
            style={styles.input}
            placeholder="مثال: PAT-65630"
            placeholderTextColor="#94A3B8"
            value={patientCode}
            onChangeText={setPatientCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleFetchRecords}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>عرض التقارير والروشتات 🚀</Text>
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
              <Text style={styles.patientName}>👤 {patientData.full_name}</Text>
              <TouchableOpacity onPress={() => setPatientData(null)}>
                <Text style={styles.logoutText}>خروج ✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.patientCodeText}>Patient ID: {patientData.patient_code}</Text>
          </View>

          <Text style={styles.sectionTitleHeader}>📋 السجلات والروشتات المعتمدة ({medicalRecords.length})</Text>

          {medicalRecords.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>لا توجد تقارير معتمدة متاحة حالياً لهذا الكود.</Text>
            </View>
          ) : (
            medicalRecords.map((item, idx) => {
              const fields = item.dynamic_fields || {};
              return (
                <View key={item.id || idx} style={styles.recordCard}>
                  <View style={styles.row}>
                    <Text style={styles.recordDate}>
                      📅 زيارة بتاريخ: {new Date(item.created_at || Date.now()).toLocaleDateString('ar-EG')}
                    </Text>
                    <Text style={styles.verifiedBadge}>✓ معتمد</Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.recordLabel}>التشخيص المعتمد:</Text>
                  <Text style={styles.recordValue}>{item.diagnosis || 'لا يوجد تشخيص مدون'}</Text>

                  {/* High-Resolution Medical Imaging Viewer (Read-Only) */}
                  {fields.scanUrl ? (
                    <View style={styles.scanBox}>
                      <Text style={styles.scanTitle}>🖼️ الأشعة والمرفقات الطبية ({fields.scanTitle || 'معاينة الأشعة'}):</Text>
                      <Image source={{ uri: fields.scanUrl }} style={styles.scanImage} resizeMode="contain" />
                    </View>
                  ) : null}

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
  container: { flex: 1, backgroundColor: '#0F172A', padding: 15 },
  header: { marginBottom: 20, alignItems: 'center', marginTop: 15 },
  headerLogo: { width: 70, height: 70, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#38BDF8', textAlign: 'center' },
  doctorSub: { fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#1E293B', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 15, textAlign: 'right' },
  sectionTitleHeader: { fontSize: 15, fontWeight: 'bold', color: '#F8FAFC', marginVertical: 15, textAlign: 'right' },
  label: { fontSize: 13, color: '#CBD5E1', marginBottom: 8, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#475569', borderRadius: 10, padding: 12, backgroundColor: '#0F172A', color: '#FFFFFF', fontSize: 15, textAlign: 'center', marginBottom: 15 },
  btn: { backgroundColor: '#0284C7', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  backBtn: { marginTop: 18, alignItems: 'center', padding: 6 },
  backBtnText: { color: '#38BDF8', fontSize: 13, fontWeight: 'bold' },
  patientCard: { backgroundColor: '#1E293B', padding: 16, borderRadius: 12, borderRightWidth: 4, borderRightColor: '#38BDF8', marginBottom: 10 },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  patientName: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
  logoutText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
  patientCodeText: { color: '#38BDF8', fontSize: 12, marginTop: 4, textAlign: 'right', fontFamily: 'monospace' },
  recordCard: { backgroundColor: '#1E293B', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  recordDate: { fontSize: 12, color: '#94A3B8' },
  verifiedBadge: { backgroundColor: '#065F46', color: '#34D399', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 10 },
  recordLabel: { fontSize: 12, color: '#94A3B8', textAlign: 'right', marginBottom: 4 },
  recordValue: { fontSize: 14, color: '#F8FAFC', textAlign: 'right', marginBottom: 15 },
  scanBox: { backgroundColor: '#0F172A', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  scanTitle: { fontSize: 11, fontWeight: 'bold', color: '#38BDF8', marginBottom: 8, textAlign: 'right' },
  scanImage: { width: '100%', height: 200, borderRadius: 6 },
  downloadPdfBtn: { backgroundColor: '#059669', padding: 12, borderRadius: 8, alignItems: 'center' },
  downloadPdfBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  emptyBox: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#64748B', fontSize: 13 }
});
 
