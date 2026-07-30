import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import DynamicFormBuilder from '../components/DynamicFormBuilder';
import { generatePrescriptionPDF } from '../components/PDFGenerator';
import { supabase } from '../supabaseClient';

export default function DoctorDashboard() {
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [dynamicData, setDynamicData] = useState({});
  const [loading, setLoading] = useState(false);

  const specialtySchema = [
    { key: 'symptoms', label: 'الأعراض والشكوى (Symptoms)', type: 'textarea', placeholder: 'اكتب الشكوى والأعراض...' },
    { key: 'vital_signs', label: 'العلامات الحيوية (Vital Signs)', type: 'input', placeholder: 'مثل: 120/80 BP, 37 C' }
  ];

  const handleDynamicChange = (key, value) => {
    setDynamicData(prev => ({ ...prev, [key]: value }));
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

      const { data: patient, error: pErr } = await supabase
        .from('patients')
        .insert([{
          full_name: patientName,
          phone: patientPhone,
          patient_code: generatedCode,
          clinic_id: clinic.id
        }])
        .select()
        .single();

      if (pErr) throw pErr;

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

      Alert.alert('تم بنجاح', 'تم حفظ بيانات الحالة الطبية وقاعدة البيانات جاهزة!');
      
      setPatientName('');
      setPatientPhone('');
      setDiagnosis('');
      setDynamicData({});

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
        <Text style={styles.subtitle}>منظومة إدارة الكشف الطبي الذكية</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>بيانات المريض الأساسية</Text>
        
        <Text style={styles.label}>اسم المريض بالكامل *</Text>
        <TextInput 
          style={styles.input} 
          placeholder="أدخل اسم المريض..." 
          placeholderTextColor="#94A3B8"
          value={patientName}
          onChangeText={setPatientName}
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

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>التشخيص والكشف الطبي</Text>
        
        <Text style={styles.label}>التشخيص النهائي (Diagnosis)</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="اكتب التشخيص والتوصيات هنا..." 
          placeholderTextColor="#94A3B8"
          multiline 
          numberOfLines={3}
          value={diagnosis}
          onChangeText={setDiagnosis}
        />

        <Text style={styles.sectionTitle}>حقول التخصص الديناميكية</Text>
        <DynamicFormBuilder 
          schema={specialtySchema} 
          formData={dynamicData} 
          onChange={handleDynamicChange} 
        />
      </View>

      <TouchableOpacity 
        style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
        onPress={handleSaveAndPrint}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>حفظ الكشف وإصدار الروشتة (PDF)</Text>
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
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});
