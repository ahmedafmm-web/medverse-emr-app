import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import DynamicFormBuilder from '../components/DynamicFormBuilder';
import { generatePrescriptionPDF } from '../components/PDFGenerator';
import { supabase } from '../supabaseClient';

// 🔑 مفتاح Groq API لتشغيل LLaMA 3.3 70B
const GROQ_API_KEY = "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";

export default function DoctorDashboard() {
  const [specialty, setSpecialty] = useState('Cardiology & Internal Medicine');
  
  // بيانات المريض والديموغرافية
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('ذكر');
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');
  const [symptomsInput, setSymptomsInput] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');

  // حالات AI والأدوية
  const [analyzing, setAnalyzing] = useState(false);
  const [checkingMed, setCheckingMed] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [medCheckError, setMedCheckError] = useState(null);

  // الخطة المعتمدة
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [prescribedMeds, setPrescribedMeds] = useState([]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedReason, setNewMedReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [patientHistory, setPatientHistory] = useState([]);
  const [searchingHistory, setSearchingHistory] = useState(false);

  // 🤖 التحليل الإكلينيكي بواسطة LLaMA 3.3 70B عبر Groq
  const handleClinicalAnalysis = async () => {
    if (!symptomsInput.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة الأعراض والشكوى الحالية للمريض أولاً.');
      return;
    }

    setAnalyzing(true);

    const systemPrompt = `You are a Senior Consultant Specialist in: ${specialty}.
You strictly adhere to international evidence-based guidelines.

CLINICAL REQUIREMENTS:
1. DIAGNOSIS: Precise medical terminology in ENGLISH with accurate ARABIC explanation.
2. MODERN MEDICATIONS: Prescribe modern GDMT tailored to specialty ${specialty}.
   - "name": Drug Name STRICTLY IN ENGLISH.
   - "dose": Detailed dose in ARABIC.
   - "reason": Clinical justification in ARABIC.
3. WARNINGS: Emergency red flags & drug interactions in ARABIC.
4. Return ONLY valid JSON matching the exact schema requested without markdown.`;

    const userPrompt = `Analyze the following patient case for ${specialty}:
- Age: ${age || 'Unspecified'} | Gender: ${gender}
- Chronic Diseases: ${chronicDiseases || 'None'}
- Family History: ${familyHistory || 'None'}
- Current Symptoms: ${symptomsInput}
- Clinical Findings/Notes: ${doctorNotes || 'None'}

JSON Structure Required:
{
  "diagnosis": "English Medical Term - الشرح بالعربي",
  "warnings": ["تحذير إكلينيكي بالعربي"],
  "medications": [
    {
      "name": "English Scientific/Trade Name",
      "dose": "الجرعة بالعربي",
      "reason": "دواعي الاستعمال بالعربي"
    }
  ]
}`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      const parsedResult = JSON.parse(data.choices[0].message.content);

      setAiReport(parsedResult);
      setFinalDiagnosis(parsedResult.diagnosis || '');
      setPrescribedMeds(parsedResult.medications || []);

    } catch (error) {
      console.error("Groq API Error:", error);
      Alert.alert('خطأ الاتصال', 'تعذر الاتصال بمحرك LLaMA 3.3 70B، تأكد من الاتصال.');
    } finally {
      setAnalyzing(false);
    }
  };

  // 🔍 فحص وإضافة دواء يدوي عبر الـ AI
  const handleCheckAndAddManualMed = async () => {
    if (!newMedName.trim() || !newMedDose.trim()) {
      Alert.alert('تنبيه', 'أدخل اسم الدواء والجرعة على الأقل.');
      return;
    }

    setCheckingMed(true);
    setMedCheckError(null);

    const systemPrompt = `You are a Clinical Pharmacologist for specialty: ${specialty}. Check if adding this new medication is safe for the patient based on age, chronic conditions, and current prescribed list.
Return JSON ONLY:
{
  "safe": true/false,
  "reason": "توضيح التعارض بالعربي إن وجد"
}`;

    const userPrompt = `
- Specialty: ${specialty} | Age: ${age || 'Unspecified'}
- Chronic Diseases: ${chronicDiseases || 'None'}
- Currently Prescribed: ${JSON.stringify(prescribedMeds.map(m => m.name))}
- New Proposed Drug: ${newMedName} (${newMedDose})
`;

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      const data = await res.json();
      const parsed = JSON.parse(data.choices[0].message.content);

      if (parsed.safe) {
        setPrescribedMeds(prev => [...prev, { name: newMedName, dose: newMedDose, reason: newMedReason || 'إضافة مباشرة من الطبيب' }]);
        setNewMedName('');
        setNewMedDose('');
        setNewMedReason('');
      } else {
        setMedCheckError(parsed.reason || 'قد يتعارض هذا الدواء مع الحالة الحالية.');
      }
    } catch (e) {
      setPrescribedMeds(prev => [...prev, { name: newMedName, dose: newMedDose, reason: newMedReason || 'إضافة مباشرة من الطبيب' }]);
      setNewMedName('');
      setNewMedDose('');
      setNewMedReason('');
    } finally {
      setCheckingMed(false);
    }
  };

  const handleRemoveMed = (index) => {
    setPrescribedMeds(prev => prev.filter((_, i) => i !== index));
  };

  // 📂 البحث عن المريض واستدعاء سجل الزيارات من Supabase
  const fetchPatientHistory = async (name) => {
    if (!name || name.trim().length < 3) {
      setPatientHistory([]);
      return;
    }
    setSearchingHistory(true);
    try {
      const { data: patient } = await supabase
        .from('patients')
        .select('id, patient_code')
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

  // 📄 اعتماد الكشف وتخزينه سحابياً وتنزيل PDF
  const handleSaveAndPrint = async () => {
    if (!patientName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم المريض أولاً.');
      return;
    }

    setLoading(true);
    const generatedCode = 'PAT-' + Math.floor(10000 + Math.random() * 90000);

    try {
      let { data: clinic } = await supabase.from('clinics').select('id').limit(1).single();

      if (!clinic) {
        const { data: newClinic, error: cErr } = await supabase
          .from('clinics')
          .insert([{ doctor_name: 'د. أحمد محمد', specialty, clinic_name: 'MedVerse Clinic' }])
          .select()
          .single();
        if (cErr) throw cErr;
        clinic = newClinic;
      }

      let { data: patient } = await supabase
        .from('patients')
        .select('id, patient_code')
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

      const activeCode = patient.patient_code || generatedCode;

      const fullRecord = {
        age,
        gender,
        chronicDiseases,
        familyHistory,
        symptoms: symptomsInput,
        doctorNotes,
        medications: prescribedMeds
      };

      const { error: rErr } = await supabase
        .from('medical_records')
        .insert([{
          patient_id: patient.id,
          clinic_id: clinic.id,
          diagnosis: finalDiagnosis,
          dynamic_fields: fullRecord,
          qr_verification_code: 'VERIFY-' + activeCode
        }]);

      if (rErr) throw rErr;

      await generatePrescriptionPDF(
        { name: patientName, phone: patientPhone, code: activeCode },
        finalDiagnosis,
        {
          'السن والنوع': `${age || 'غير محدد'} سنة (${gender})`,
          'الأمراض المزمنة': chronicDiseases || 'لا يوجد',
          'ملاحظات الفحوصات والأشعة': doctorNotes || 'لا يوجد'
        },
        prescribedMeds
      );

      Alert.alert('تم اعتماد الزيارة', `تم حفظ الكشف برقم [${activeCode}] وتوليد الروشتة PDF بنجاح! 🚀`);

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
        <Text style={styles.subtitle}>لوحة تحكم الطبيب السريرية (Powered by LLaMA 3.3 70B)</Text>
      </View>

      {/* البيانات الكلينيكية والمريض */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>👤 البيانات الأساسية لكارت المريض</Text>
        
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
              placeholder="مثال: 58" 
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

        <Text style={styles.label}>الأمراض المزمنة</Text>
        <TextInput 
          style={styles.input} 
          placeholder="مثال: ضغط، سكر نوع ثاني..." 
          placeholderTextColor="#94A3B8"
          value={chronicDiseases}
          onChangeText={setChronicDiseases}
        />

        <Text style={styles.label}>التاريخ المرضي العائلي</Text>
        <TextInput 
          style={styles.input} 
          placeholder="مثال: أمراض قلب..." 
          placeholderTextColor="#94A3B8"
          value={familyHistory}
          onChangeText={setFamilyHistory}
        />
      </View>

      {/* سجل الزيارات السابق */}
      {searchingHistory && <ActivityIndicator color="#0284C7" style={{ marginBottom: 15 }} />}
      {patientHistory.length > 0 && (
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>📚 تاريخ الزيارات السابقة للمريض ({patientHistory.length} زيارات)</Text>
          {patientHistory.map((item, index) => (
            <View key={item.id || index} style={styles.historyItem}>
              <Text style={styles.historyDate}>📅 {new Date(item.created_at).toLocaleDateString('ar-EG')}</Text>
              <Text style={styles.historyDiagnosis}><strong>التشخيص:</strong> {item.diagnosis || 'لا يوجد'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* الأعراض وملاحظات الأشعة والذكاء الاصطناعي */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🩺 الشكوى الحالية وملاحظات الفحوصات</Text>
        
        <Text style={styles.label}>الأعراض والشكوى الحالية:</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="صف الأعراض بالتفصيل..." 
          placeholderTextColor="#94A3B8"
          multiline 
          numberOfLines={3}
          value={symptomsInput}
          onChangeText={setSymptomsInput}
        />

        <Text style={styles.label}>ملاحظات الأشعة والتحاليل والمتابعة:</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="اكتب ملاحظات الفحوصات أو نتائج الأشعة..." 
          placeholderTextColor="#94A3B8"
          multiline 
          numberOfLines={2}
          value={doctorNotes}
          onChangeText={setDoctorNotes}
        />

        <TouchableOpacity 
          style={styles.aiButton} 
          onPress={handleClinicalAnalysis}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.aiButtonText}>✨ تحليل الحالة بـ LLaMA 3.3 70B AI</Text>
          )}
        </TouchableOpacity>

        {aiReport && (
          <View style={styles.aiReportBox}>
            <Text style={styles.aiReportHeader}>📋 التقرير الطبي المولد من الذكاء الاصطناعي:</Text>
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

      {/* القرارات الطبية وتنسيق الأدوية */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📝 اعتماد الخطة العلاجية والروشتة</Text>

        <Text style={styles.label}>التشخيص المعتمد النهائي:</Text>
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
            <Text style={styles.medDetail}><strong>دواعي الاستعمال:</strong> {med.reason}</Text>
          </View>
        ))}

        {/* إضافة دواء مع الفحص */}
        <View style={styles.addMedBox}>
          <Text style={styles.label}>إضافة دواء يدوي (مع فحص التفاعلات):</Text>
          <TextInput 
            style={styles.input} 
            placeholder="اسم الدواء (إنجليزي)" 
            placeholderTextColor="#94A3B8"
            value={newMedName}
            onChangeText={setNewMedName}
          />
          <TextInput 
            style={styles.input} 
            placeholder="الجرعة والتوقيت" 
            placeholderTextColor="#94A3B8"
            value={newMedDose}
            onChangeText={setNewMedDose}
          />
          <TextInput 
            style={styles.input} 
            placeholder="دواعي الاستعمال" 
            placeholderTextColor="#94A3B8"
            value={newMedReason}
            onChangeText={setNewMedReason}
          />
          
          <TouchableOpacity style={styles.addMedBtn} onPress={handleCheckAndAddManualMed} disabled={checkingMed}>
            {checkingMed ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.addMedBtnText}>🔍 فحص وإضافة الدواء للروشتة</Text>
            )}
          </TouchableOpacity>

          {medCheckError && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>🚨 تحذير تعارض: {medCheckError}</Text>
            </View>
          )}
        </View>
      </View>

      {/* زر الاعتماد وحفظ الـ PDF */}
      <TouchableOpacity 
        style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
        onPress={handleSaveAndPrint}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>اعتماد التقرير وتنزيل الروشتة PDF 🖨️</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 15 },
  header: { marginBottom: 20, alignItems: 'center', marginTop: 15 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#38BDF8' },
  subtitle: { fontSize: 12, color: '#94A3B8', marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: '#1E293B', padding: 16, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 10, textAlign: 'right' },
  subSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#38BDF8', marginTop: 12, marginBottom: 8, textAlign: 'right' },
  label: { fontSize: 12, color: '#CBD5E1', marginBottom: 4, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#475569', borderRadius: 8, padding: 10, backgroundColor: '#0F172A', marginBottom: 12, textAlign: 'right', color: '#FFFFFF', fontSize: 13 },
  rowInputs: { flexDirection: 'row-reverse' },
  textArea: { height: 70, textAlignVertical: 'top' },
  aiButton: { backgroundColor: '#0284C7', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  aiButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  aiReportBox: { backgroundColor: '#0369A1/30', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#0284C7' },
  aiReportHeader: { fontSize: 12, fontWeight: 'bold', color: '#38BDF8', marginBottom: 6, textAlign: 'right' },
  warningBox: { backgroundColor: '#991B1B/40', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#EF4444', marginTop: 6, marginBottom: 6 },
  warningText: { color: '#FCA5A5', fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  aiDiagText: { fontSize: 12, color: '#F8FAFC', textAlign: 'right' },
  medCard: { backgroundColor: '#0F172A', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  medHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  medName: { fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' },
  deleteText: { color: '#EF4444', fontSize: 11, fontWeight: 'bold' },
  medDetail: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 2 },
  addMedBox: { backgroundColor: '#0F172A', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#334155' },
  addMedBtn: { backgroundColor: '#334155', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 4 },
  addMedBtnText: { color: '#38BDF8', fontSize: 12, fontWeight: 'bold' },
  saveButton: { backgroundColor: '#059669', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 35 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  historyCard: { backgroundColor: '#1E293B', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#0284C7' },
  historyTitle: { fontSize: 12, fontWeight: 'bold', color: '#38BDF8', marginBottom: 6, textAlign: 'right' },
  historyItem: { backgroundColor: '#0F172A', padding: 8, borderRadius: 6, marginBottom: 6 },
  historyDate: { fontSize: 10, color: '#38BDF8', fontWeight: 'bold', textAlign: 'right' },
  historyDiagnosis: { fontSize: 11, color: '#CBD5E1', textAlign: 'right' }
});
