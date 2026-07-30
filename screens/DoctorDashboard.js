import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList } from 'react-native';
import DynamicFormBuilder from '../components/DynamicFormBuilder';
import { generatePrescriptionPDF } from '../components/PDFGenerator';
import { supabase } from '../supabaseClient';

export default function DoctorDashboard() {
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [dynamicData, setDynamicData] = useState({});
  const [loading, setLoading] = useState(false);
  
  // 🕒 حالة سجل الزيارات الزمني للمريض
  const [patientHistory, setPatientHistory] = useState([]);
  const [searchingHistory, setSearchingHistory] = useState(false);

  // 1. القوالب الجاهزة (Presets)
  const [presets] = useState([
    {
      name: 'نزلة برد حادة',
      diagnosis: 'Acute Upper Respiratory Tract Infection',
      data: {
        symptoms: 'ارتفاع في الحرارة، رشح، وسعال جاف',
        vital_signs: 'BP: 120/80, Temp: 38.5 C'
      }
    },
    {
      name: 'القولون العصبي',
      diagnosis: 'Irritable Bowel Syndrome (IBS)',
      data: {
        symptoms: 'انتفاخ، تقلصات بالبطن تزداد مع التوتر',
        vital_signs: 'BP: 115/75, Temp: 36.8 C'
      }
    }
  ]);

  // 2. مخطط حقول التخصص (Dynamic Schema)
  const [specialtySchema, setSpecialtySchema] = useState([
    { key: 'symptoms', label: 'الأعراض والشكوى (Symptoms)', type: 'textarea', placeholder: 'اكتب الشكوى والأعراض...' },
    { key: 'vital_signs', label: 'العلامات الحيوية (Vital Signs)', type: 'input', placeholder: 'مثال: 120/80 BP, 37 C' }
  ]);

  const handleDynamicChange = (key, value) => {
    setDynamicData(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectPreset = (preset) => {
    setDiagnosis(preset.diagnosis);
    setDynamicData(prev => ({ ...prev, ...preset.data }));
    Alert.alert('تم القالب', `تم تطبيق قالب: ${preset.name}`);
  };

  // 🔍 البحث عن سجل الزيارات المترابط باسم المريض
  const fetchPatientHistory = async (name) => {
    if (!name || name.trim().length < 3) {
      setPatientHistory([]);
      return;
    }
    setSearchingHistory(true);
    try {
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .ilike('full_name', `%${name.trim()}%`)
        .limit(1)
        .single();

      if (patient) {
        const { data: records } = await supabase
          .from('medical_records')
          .select('*')
          .eq('patient_id', patient.id)
          .order('created_at', { ascending: false });

        setPatientHistory(records || []);
      } else {
        setPatientHistory([]);
      }
    } catch (e) {
      setPatientHistory([]);
    } finally {
      setSearchingHistory(false);
    }
  };

  const handleSaveAndPrint = async () => {
    if (!patientName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم المريض أولاً.');
      return;
    }

    setLoading(true);
    const generatedCode = 'PAT-' + Math.floor(1000 + Math.random() * 9000);

    try {
      let { data: clinic } = await supabase.from('clinics').select('id').limit(1).single();

      if (!clinic) {
        const { data: newClinic, error: cErr } = await supabase
          .from('clinics')
          .insert([{ doctor_name: 'د. أحمد محمد', specialty: 'طب عام', clinic_name: 'MedVerse Clinic' }])
          .select()
          .single();
        if (cErr) throw cErr;
        clinic = newClinic;
      }

      let { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('full_name', patientName.trim())
        .single();

      if (!patient) {
        const { data: newPatient, error: pErr } = await supabase
          .from('patients')
          .insert([{
            full_name: patientName.trim(),
            phone: patientPhone,
            patient_code: generatedCode,
            clinic_id: clinic.id
          }])
          .select()
          .single();

        if (pErr) throw pErr;
        patient = newPatient;
      }

      const { error: rErr } = await supabase
        .from('medical_records')
        .insert([{
          patient_id: patient.id,
          clinic_id: clinic.id,
          diagnosis: diagnosis,
          dynamic_fields: dynamicData,
          qr_verification_code: 'VERIFY-' + Math.random().toString(36).substring(7).toUpperCase()
        }]);

      if (rErr) throw rErr;

      await generatePrescriptionPDF(
        { name: patientName, phone: patientPhone, code: generatedCode },
        diagnosis,
        dynamicData
      );

      Alert.alert('نجاح العمليات', 'تم حفظ الزيارة بالسحابة وإصدار الروشتة المعتمدة بنجاح! 🚀');
      
      setPatientName('');
      setPatientPhone('');
      setDiagnosis('');
      setDynamicData({});
      setPatientHistory([]);

    } catch (error) {
      Alert.alert('خطأ أثناء الحفظ', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MedVerse EMR</Text>
        <Text style={styles.subtitle}>منظومة إدارة الكشف والتشخيص الذكي</Text>
      </View>

      {/* بيانات المريض والبحث عن التاريخ */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>👤 بيانات المريض الأساسية</Text>
        
        <Text style={styles.label}>اسم المريض بالكامل *</Text>
        <TextInput 
          style={styles.input} 
          placeholder="أدخل اسم المريض..." 
          placeholderTextColor="#94A3B8"
          value={patientName}
          onChangeText={(val) => {
            setPatientName(val);
            fetchPatientHistory(val);
          }}
        />

        <Text style={styles.label}>رقم الهاتف</Text>
        <TextInput 
          style={styles.input} 
          placeholder="01xxxxxxxxx" 
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
          value={patientPhone}
          onChangeText={setPatientPhone}
        />
      </View>

      {/* 🕒 شريط سجل الزيارات الزمني (Visits Timeline) */}
      {searchingHistory && <ActivityIndicator color="#0284C7" style={{ marginBottom: 15 }} />}
      {patientHistory.length > 0 && (
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>🕒 سجل الزيارات السابقة للمريض ({patientHistory.length} زيارات)</Text>
          {patientHistory.map((item, index) => (
            <View key={item.id || index} style={styles.historyItem}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyDate}>📅 {new Date(item.created_at).toLocaleDateString('ar-EG')}</Text>
              </View>
              <Text style={styles.historyDiagnosis}><strong>التشخيص:</strong> {item.diagnosis || 'لا يوجد'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* التشخيص وحقول التخصص */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🩺 التشخيص والكشف الطبي الحالي</Text>
        
        <Text style={styles.label}>التشخيص النهائي (Diagnosis)</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="اكتب التشخيص والتوصيات..." 
          placeholderTextColor="#94A3B8"
          multiline 
          numberOfLines={3}
          value={diagnosis}
          onChangeText={setDiagnosis}
        />

        <Text style={styles.sectionTitle}>⚙️ حقول التخصص والقوالب السريعة</Text>
        <DynamicFormBuilder 
          schema={specialtySchema} 
          formData={dynamicData} 
          onChange={handleDynamicChange}
          onUpdateSchema={setSpecialtySchema}
          presets={presets}
          onSelectPreset={handleSelectPreset}
        />
      </View>

      {/* زر الحفظ والطباعة */}
      <TouchableOpacity 
        style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
        onPress={handleSaveAndPrint}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>حفظ الزيارة وإصدار الروشتة (PDF) 🖨️</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 15 },
  header: { marginBottom: 20, alignItems: 'center', marginTop: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#0F172A', marginBottom: 12, textAlign: 'right' },
  label: { fontSize: 13, color: '#475569', marginBottom: 6, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 11, backgroundColor: '#FFFFFF', marginBottom: 14, textAlign: 'right', color: '#0F172A' },
  textArea: { height: 75, textAlignVertical: 'top' },
  saveButton: { backgroundColor: '#0F172A', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 35 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  historyCard: { backgroundColor: '#F0F9FF', padding: 14, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#BAE6FD' },
  historyTitle: { fontSize: 13, fontWeight: 'bold', color: '#0369A1', marginBottom: 10, textAlign: 'right' },
  historyItem: { backgroundColor: '#FFFFFF', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E0F2FE' },
  historyHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  historyDate: { fontSize: 11, color: '#0284C7', fontWeight: 'bold' },
  historyDiagnosis: { fontSize: 12, color: '#334155', textAlign: 'right' }
});
