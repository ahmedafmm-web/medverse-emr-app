import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import DynamicFormBuilder from '../components/DynamicFormBuilder';
import { generatePrescriptionPDF } from '../components/PDFGenerator';
import { supabase } from '../supabaseClient';

// 🔑 تم دمج مفتاح Gemini API الخاص بك
const GEMINI_API_KEY = "AQ.Ab8RN6LIuoiJFa9xuw93wRdHRMOF3y89PeeyA7kItoZpriGgAA";

export default function DoctorDashboard() {
  // بيانات المريض
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('ذكر');
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');
  const [symptomsInput, setSymptomsInput] = useState('');

  // حالة التحليل بالذكاء الاصطناعي
  const [analyzing, setAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);

  // القرار الطبي القابل للتعديل
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [prescribedMeds, setPrescribedMeds] = useState([]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedReason, setNewMedReason] = useState('');

  const [dynamicData, setDynamicData] = useState({});
  const [loading, setLoading] = useState(false);

  // 🕒 سجل الزيارات الزمني
  const [patientHistory, setPatientHistory] = useState([]);
  const [searchingHistory, setSearchingHistory] = useState(false);

  const [specialtySchema, setSpecialtySchema] = useState([
    { key: 'vital_signs', label: 'العلامات الحيوية (Vital Signs)', type: 'input', placeholder: 'مثال: 120/80 BP, 37 C' }
  ]);

  // 🤖 الربط المباشر مع نموذج Gemini 1.5 Flash المجاني
  const handleClinicalAnalysisWithGemini = async () => {
    if (!symptomsInput.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة الأعراض والشكوى الحالية للمريض أولاً.');
      return;
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
      Alert.alert('تنبيه الـ API Key', 'يرجى وضع مفتاح Gemini API Key المجاني داخل الكود أولاً لتفعيل الذكاء الاصطناعي.');
      return;
    }

    setAnalyzing(true);

    // صياغة البرومبت الإكلينيكي الموجه للنموذج
    const promptText = `
أنت استشاري طبي وتعمل كمساعد إكلينيكي في نظام EMR.
قم بتحليل بيانات المريض التالية بجدية ودقة طبية عالية:
- السن: ${age || 'غير محدد'}
- النوع: ${gender}
- الأمراض المزمنة/الحالية: ${chronicDiseases || 'لا يوجد'}
- التاريخ المرضي العائلي: ${familyHistory || 'لا يوجد'}
- الشكوى والأعراض الحالية: ${symptomsInput}

المطلوب:
ارسل الإجابة فقط بتنسيق JSON صحيح تماماً وبدون أي نصوص إضافية قبل أو بعد الـ JSON، مستخدماً الهيكل التالي بالظبط:
{
  "diagnosis": "التشخيص الدقيق والمفصل باللغة العربية مع الاسم العلمي",
  "warnings": ["قائمة بأي تعارضات دارجية أو محاذير مع الأمراض المزمنة أو السن إن وجدت"],
  "medications": [
    {
      "name": "اسم الدواء العلمي أو التجاري الشهير",
      "dose": "الجرعة المقترحة وكيفية الاستخدام",
      "reason": "سبب اختيار هذا الدواء بالظبط للحالة",
      "alternatives": "أسماء الأدوبة البديلة المتاحة"
    }
  ]
}
`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        }
      );

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        let rawText = data.candidates[0].content.parts[0].text;
        
        // تنظيف النص للحصول على الـ JSON بشكل صافي
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedResult = JSON.parse(rawText);

        setAiReport(parsedResult);
        setFinalDiagnosis(parsedResult.diagnosis || '');
        setPrescribedMeds(parsedResult.medications || []);
      } else {
        throw new Error("لم يتم استلام استجابة صحيحة من النموذج.");
      }

    } catch (error) {
      console.error("Gemini API Error:", error);
      Alert.alert('خطأ في الاتصال بالذكاء الاصطناعي', 'تأكد من صحة المفتاح والاتصال بالإنترنت.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddManualMed = () => {
    if (!newMedName.trim()) {
      Alert.alert('تنبيه', 'أدخل اسم الدواء أولاً.');
      return;
    }
    const newMed = {
      name: newMedName,
      dose: newMedDose || 'حسب إرشادات الطبيب',
      reason: newMedReason || 'إضافة مباشرة من الطبيب المعالج',
      alternatives: 'غير محدد'
    };
    setPrescribedMeds(prev => [...prev, newMed]);
    setNewMedName('');
    setNewMedDose('');
    setNewMedReason('');
  };

  const handleRemoveMed = (index) => {
    setPrescribedMeds(prev => prev.filter((_, i) => i !== index));
  };

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

      const fullReportData = {
        ...dynamicData,
        age,
        gender,
        chronicDiseases,
        familyHistory,
        symptoms: symptomsInput,
        medications: prescribedMeds
      };

      const { error: rErr } = await supabase
        .from('medical_records')
        .insert([{
          patient_id: patient.id,
          clinic_id: clinic.id,
          diagnosis: finalDiagnosis,
          dynamic_fields: fullReportData,
          qr_verification_code: 'VERIFY-' + Math.random().toString(36).substring(7).toUpperCase()
        }]);

      if (rErr) throw rErr;

      await generatePrescriptionPDF(
        { name: patientName, phone: patientPhone, code: generatedCode },
        finalDiagnosis,
        {
          'السن والنوع': `${age || 'غير محدد'} سنة (${gender})`,
          'الأمراض المزمنة': chronicDiseases || 'لا يوجد',
          'الأدوية المعتمدة': prescribedMeds.map(m => `• ${m.name} - ${m.dose}\n  السبب: ${m.reason}\n  البديل: ${m.alternatives}`).join('\n\n')
        }
      );

      Alert.alert('تم اعتماد التقرير', 'تم حفظ التقرير الطبي الشامل وإصدار الروشتة المعتمدة بالسحابة! 🚀');

      setPatientName('');
      setPatientPhone('');
      setAge('');
      setChronicDiseases('');
      setFamilyHistory('');
      setSymptomsInput('');
      setFinalDiagnosis('');
      setPrescribedMeds([]);
      setAiReport(null);

    } catch (error) {
      Alert.alert('خطأ أثناء الحفظ', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MedVerse Smart EMR Suite</Text>
        <Text style={styles.subtitle}>الاستشاري الإكلينيكي الذكي (Powered by Gemini AI)</Text>
      </View>

      {/* 1. الملف الطبي والديموغرافي الشامل */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>👤 البيانات الشخصية والمرضية الشاملة</Text>
        
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

        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>السن</Text>
            <TextInput 
              style={styles.input} 
              placeholder="مثال: 35" 
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
            />
          </View>

          <View style={{ flex: 1 }}>
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
        </View>

        <Text style={styles.label}>الأمراض الحالية والمزمنة (إن وجدت)</Text>
        <TextInput 
          style={styles.input} 
          placeholder="مثال: ضغط، سكر، حساسية بنسلين..." 
          placeholderTextColor="#94A3B8"
          value={chronicDiseases}
          onChangeText={setChronicDiseases}
        />

        <Text style={styles.label}>التاريخ المرضي العائلي (Family History)</Text>
        <TextInput 
          style={styles.input} 
          placeholder="مثال: تاريخ عائلي لأمراض القلب أو أمراض وراثية..." 
          placeholderTextColor="#94A3B8"
          value={familyHistory}
          onChangeText={setFamilyHistory}
        />
      </View>

      {/* 🕒 سجل الزيارات الزمني */}
      {searchingHistory && <ActivityIndicator color="#0284C7" style={{ marginBottom: 15 }} />}
      {patientHistory.length > 0 && (
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>🕒 الزيارات السابقة ({patientHistory.length} زيارة مسجلة)</Text>
          {patientHistory.map((item, index) => (
            <View key={item.id || index} style={styles.historyItem}>
              <Text style={styles.historyDate}>📅 {new Date(item.created_at).toLocaleDateString('ar-EG')}</Text>
              <Text style={styles.historyDiagnosis}><strong>التشخيص:</strong> {item.diagnosis || 'لا يوجد'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 2. الشكوى والتحليل عبر Gemini AI */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🩺 الأعراض والشكوى الحالية</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="صف الأعراض وملاحظات الكشف بالتفصيل..." 
          placeholderTextColor="#94A3B8"
          multiline 
          numberOfLines={3}
          value={symptomsInput}
          onChangeText={setSymptomsInput}
        />

        <TouchableOpacity 
          style={styles.aiButton} 
          onPress={handleClinicalAnalysisWithGemini}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.aiButtonText}>✨ تحليل الحالة بـ Gemini AI وكشف التعارضات</Text>
          )}
        </TouchableOpacity>

        {aiReport && (
          <View style={styles.aiReportBox}>
            <Text style={styles.aiReportHeader}>📋 التقرير الاستشاري المولد من Gemini AI:</Text>
            
            {aiReport.warnings && aiReport.warnings.length > 0 && (
              <View style={styles.warningBox}>
                {aiReport.warnings.map((w, idx) => (
                  <Text key={idx} style={styles.warningText}>⚠️ {w}</Text>
                ))}
              </View>
            )}

            <Text style={styles.aiDiagText}><strong>التشخيص المقترح:</strong> {aiReport.diagnosis}</Text>
          </View>
        )}
      </View>

      {/* 3. لوحة مراجعة الطبيب وتعديل الأدوية */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📝 مراجعة القرارات الطبية والتعديل الحر</Text>
        <Text style={styles.hintText}>* يحق للطبيب تعديل أو إضافة أو حذف أي عنصر من التشخيص أو الخطة العلاجية.</Text>

        <Text style={styles.label}>التشخيص المعتمد:</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          multiline 
          value={finalDiagnosis}
          onChangeText={setFinalDiagnosis}
        />

        <Text style={styles.subSectionTitle}>💊 قائمة الأدوية المعتمدة للروشتة ({prescribedMeds.length}):</Text>

        {prescribedMeds.map((med, index) => (
          <View key={index} style={styles.medCard}>
            <View style={styles.medHeader}>
              <Text style={styles.medName}>💊 {med.name}</Text>
              <TouchableOpacity onPress={() => handleRemoveMed(index)}>
                <Text style={styles.deleteText}>إزالة ✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.medDetail}><strong>الجرعة:</strong> {med.dose}</Text>
            <Text style={styles.medDetail}><strong>سبب الاختيار:</strong> {med.reason}</Text>
            <Text style={styles.medDetail}><strong>البدائل المتاحة:</strong> {med.alternatives}</Text>
          </View>
        ))}

        {/* إضافة دواء يدوياً */}
        <View style={styles.addMedBox}>
          <Text style={styles.label}>إضافة دواء جديد يدوياً للروشتة:</Text>
          <TextInput 
            style={styles.input} 
            placeholder="اسم الدواء..." 
            placeholderTextColor="#94A3B8"
            value={newMedName}
            onChangeText={setNewMedName}
          />
          <TextInput 
            style={styles.input} 
            placeholder="الجرعة وطريقة الاستعمال..." 
            placeholderTextColor="#94A3B8"
            value={newMedDose}
            onChangeText={setNewMedDose}
          />
          <TextInput 
            style={styles.input} 
            placeholder="سبب الاختيار (اختياري)..." 
            placeholderTextColor="#94A3B8"
            value={newMedReason}
            onChangeText={setNewMedReason}
          />
          <TouchableOpacity style={styles.addMedBtn} onPress={handleAddManualMed}>
            <Text style={styles.addMedBtnText}>+ إضافة الدواء للقائمة</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* زر الاعتماد النهائي */}
      <TouchableOpacity 
        style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
        onPress={handleSaveAndPrint}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>اعتماد التقرير وإصدار الروشتة المعتمدة (PDF) 🖨️</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 15 },
  header: { marginBottom: 20, alignItems: 'center', marginTop: 15 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#0284C7', marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#0F172A', marginBottom: 10, textAlign: 'right' },
  subSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#0284C7', marginTop: 12, marginBottom: 8, textAlign: 'right' },
  hintText: { fontSize: 11, color: '#0284C7', marginBottom: 10, textAlign: 'right' },
  label: { fontSize: 12, color: '#475569', marginBottom: 4, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, backgroundColor: '#FFFFFF', marginBottom: 12, textAlign: 'right', color: '#0F172A', fontSize: 13 },
  rowInputs: { flexDirection: 'row-reverse' },
  textArea: { height: 75, textAlignVertical: 'top' },
  aiButton: { backgroundColor: '#0284C7', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  aiButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  aiReportBox: { backgroundColor: '#F0F9FF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#BAE6FD' },
  aiReportHeader: { fontSize: 13, fontWeight: 'bold', color: '#0369A1', marginBottom: 6, textAlign: 'right' },
  warningBox: { backgroundColor: '#FEF2F2', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5', marginBottom: 8 },
  warningText: { color: '#991B1B', fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  aiDiagText: { fontSize: 12, color: '#0F172A', textAlign: 'right' },
  medCard: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  medHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  medName: { fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
  deleteText: { color: '#EF4444', fontSize: 11, fontWeight: 'bold' },
  medDetail: { fontSize: 11, color: '#334155', textAlign: 'right', marginTop: 2 },
  addMedBox: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8, marginTop: 10 },
  addMedBtn: { backgroundColor: '#0F172A', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 4 },
  addMedBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  saveButton: { backgroundColor: '#059669', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 35 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  historyCard: { backgroundColor: '#F0F9FF', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#BAE6FD' },
  historyTitle: { fontSize: 12, fontWeight: 'bold', color: '#0369A1', marginBottom: 6, textAlign: 'right' },
  historyItem: { backgroundColor: '#FFFFFF', padding: 8, borderRadius: 6, marginBottom: 6 },
  historyDate: { fontSize: 10, color: '#0284C7', fontWeight: 'bold', textAlign: 'right' },
  historyDiagnosis: { fontSize: 11, color: '#334155', textAlign: 'right' }
});
