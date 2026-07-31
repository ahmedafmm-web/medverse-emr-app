import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseClient';
import { generatePrescriptionPDF } from '../components/PDFGenerator';

export default function PatientPortal({ onBackToDashboard }) {
  const [patientCode, setPatientCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);

  // 🔍 استعلام عن بيانات وسجلات المريض
  const handleFetchRecords = async () => {
    if (!patientCode.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال كود المريض الفريد (Patient ID).');
      return;
    }

    setLoading(true);
    try {
      const { data: patient, error: pErr } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_code', patientCode.trim().toUpperCase())
        .single();

      if (pErr || !patient) {
        Alert.alert('خطأ', 'لم يتم العثور على مريض بهذا الرقم الفريد.');
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

    } catch (error) {
      Alert.alert('خطأ في التحميل', error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🖨️ طباعة وإعادة تنزيل الـ PDF
  const handleDownloadPDF = async (record) => {
    const fields = record.dynamic_fields || {};
    await generatePrescriptionPDF(
      { name: patientData.full_name, phone: patientData.phone, code: patientData.patient_code },
      record.diagnosis,
      {
        'السن والنوع': `${fields.age || 'غير محدد'} سنة (${fields.gender || 'غير محدد'})`,
        'الأمراض المزمنة': fields.chronicDiseases || 'لا يوجد',
        'ملاحظات الفحوصات': fields.doctorNotes || 'لا يوجد'
      },
      fields.medications || []
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MedVerse Patient Portal</Text>
        <Text style={styles.subtitle}>بوابة استعراض السجلات والروشتات الطبية المعتمدة</Text>
      </View>

      {!patientData ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔐 الدخول برقم المريض الفريد</Text>
          <Text style={styles.label}>أدخل كود المريض الخاص بك (Patient ID):</Text>
          <TextInput
            style={styles.input}
            placeholder="مثال: PAT-89210"
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
              <Text style={styles.backBtnText}>العودة للوحة التحكم الرئيسية</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View>
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
            medicalRecords.map((item, idx) => (
              <View key={item.id || idx} style={styles.recordCard}>
                <View style={styles.row}>
                  <Text style={styles.recordDate}>📅 زيارة بتاريخ: {new Date(item.created_at).toLocaleDateString('ar-EG')}</Text>
                  <Text style={styles.verifiedBadge}>✓ معتمد</Text>
                </View>

                <View style={styles.divider} />

                <Text style={styles.recordLabel}>التشخيص المعتمد:</Text>
                <Text style={styles.recordValue}>{item.diagnosis || 'لا يوجد تشخيص مدون'}</Text>

                <TouchableOpacity
                  style={styles.downloadPdfBtn}
                  onPress={() => handleDownloadPDF(item)}
                >
                  <Text style={styles.downloadPdfBtnText}>🖨️ تنزيل الروشتة المعتمدة (PDF)</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 15 },
  header: { marginBottom: 25, alignItems: 'center', marginTop: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#38BDF8' },
  subtitle: { fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#1E293B', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 15, textAlign: 'right' },
  sectionTitleHeader: { fontSize: 15, fontWeight: 'bold', color: '#F8FAFC', marginVertical: 15, textAlign: 'right' },
  label: { fontSize: 13, color: '#CBD5E1', marginBottom: 8, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#475569', borderRadius: 10, padding: 12, backgroundColor: '#0F172A', color: '#FFFFFF', fontSize: 15, textAlign: 'center', marginBottom: 15 },
  btn: { backgroundColor: '#0284C7', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  backBtn: { marginTop: 15, alignItems: 'center' },
  backBtnText: { color: '#64748B', fontSize: 12 },
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
  downloadPdfBtn: { backgroundColor: '#059669', padding: 12, borderRadius: 8, alignItems: 'center' },
  downloadPdfBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  emptyBox: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#64748B', fontSize: 13 }
});
