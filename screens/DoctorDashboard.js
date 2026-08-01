import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import DynamicFormBuilder from '../components/DynamicFormBuilder';
import { generatePrescriptionPDF } from '../components/PDFGenerator';
import { supabase } from '../supabaseClient';

const GROQ_API_KEY = "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";

// دالة لتنظيف النصوص من أي رموز غير معالجة
const sanitizeText = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/[^\u0600-\u06FF a-zA-Z0-9.,()\-\:\/]/g, '').trim();
};

export default function DoctorDashboard() {
  const [clinicDoctorName, setClinicDoctorName] = useState('د. أحمد محمد');
  const [clinicName, setClinicName] = useState('عيادة MedVerse التخصصية');
  const [specialty, setSpecialty] = useState('استشاري أمراض القلب والباطنة');
  const [clinicLogoUrl, setClinicLogoUrl] = useState('https://cdn-icons-png.flaticon.com/512/387/387561.png');

  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('ذكر');
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');

  const [symptomsInput, setSymptomsInput] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [checkingMed, setCheckingMed] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [medCheckError, setMedCheckError] = useState(null);

  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [prescribedMeds, setPrescribedMeds] = useState([]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedReason, setNewMedReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [patientHistory, setPatientHistory] = useState([]);
  const [searchingHistory, setSearchingHistory] = useState(false);

  // دالة ملء البيانات التجريبية للاختبار السريع
  const handleFillDummyData = () => {
    const dummyName = 'أحمد محمود السيد';
    setPatientName(dummyName);
    setPatientPhone('01012345678');
    setAge('54');
    setGender('ذكر');
    setChronicDiseases('ارتفاع ضغط الدم، السكري النوع الثاني');
    setFamilyHistory('تاريخ عائلي لأمراض الشرايين التاجية');
    setSymptomsInput('ألم ضاغط بوسط الصدر يمتد للكتف الأيسر مع ضيق في التنفس وتعرق، مستمر منذ ساعتين.');
    setDoctorNotes('ضغط الدم 140/90، رسم القلب يظهر تغيرات بسيطة، الفحوصات الأولية مستقرة.');
    fetchPatientHistory(dummyName);
  };

  const handleClinicalAnalysis = async () => {
    if (!symptomsInput.trim()) {
      alert('يرجى كتابة الأعراض والشكوى الحالية للمريض أولاً.');
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
      if (!data.choices || !data.choices[0]) {
        throw new Error('استجابة غير صالحة من خادم الذكاء الاصطناعي');
      }

      const parsedResult = JSON.parse(data.choices[0].message.content);

      if (parsedResult.warnings) {
        parsedResult.warnings = parsedResult.warnings.map(w => sanitizeText(w));
      }

      setAiReport(parsedResult);
      setFinalDiagnosis(parsedResult.diagnosis || '');
      setPrescribedMeds(parsedResult.medications || []);

    } catch (error) {
      console.error("Groq API Error:", error);
      alert('خطأ الاتصال: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCheckAndAddManualMed = async () => {
    if (!newMedName.trim() || !newMedDose.trim()) {
      alert('أدخل اسم الدواء والجرعة على الأقل.');
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
        setMedCheckError(sanitizeText(parsed.reason) || 'قد يتعارض هذا الدواء مع الحالة الحالية.');
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

  // البحث في التاريخ المرضي
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

  // دالة الحفظ والطباعة المعدلة والمكتملة بحقل qr_verification_code
  const handleSaveAndPrint = async () => {
    if (!patientName.trim()) {
      alert('تنبيه هام: يرجى إدخال اسم المريض بالكامل أولاً قبل الاعتماد والطباعة.');
      return;
    }

    setLoading(true);
    const generatedCode = 'PAT-' + Math.floor(10000 + Math.random() * 90000);

    try {
      // 1️⃣ إحضار أو إنشاء العيادة باستخدام maybeSingle لمنع توقف الكود
      let clinicId = null;
      const { data: existingClinic } = await supabase
        .from('clinics')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existingClinic) {
        clinicId = existingClinic.id;
      } else {
        const { data: newClinic, error: cErr } = await supabase
          .from('clinics')
          .insert([{ 
            doctor_name: clinicDoctorName, 
            specialty: specialty, 
            clinic_name: clinicName,
            logo_url: clinicLogoUrl
          }])
          .select('id')
          .single();

        if (cErr) throw new Error('خطأ في حفظ بيانات العيادة: ' + cErr.message);
        clinicId = newClinic?.id;
      }

      // 2️⃣ إحضار أو إنشاء المريض باستخدام maybeSingle
      let patientRealId = null;
      let patientRealCode = generatedCode;

      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id, patient_code')
        .eq('full_name', patientName.trim())
        .maybeSingle();

      if (existingPatient) {
        patientRealId = existingPatient.id;
        patientRealCode = existingPatient.patient_code;
      } else {
        const { data: newPatient, error: pErr } = await supabase
          .from('patients')
          .insert([{
            full_name: patientName.trim(),
            phone: patientPhone || null,
            age: age ? parseInt(age) : null,
            gender: gender,
            patient_code: generatedCode,
            clinic_id: clinicId
          }])
          .select('id, patient_code')
          .single();

        if (pErr) throw new Error('خطأ في حفظ بيانات المريض: ' + pErr.message);
        patientRealId = newPatient?.id;
        patientRealCode = newPatient?.patient_code || generatedCode;
      }

      // 3️⃣ حفظ السجل الطبي في جدول medical_records مع رمز التحقق الإلكتروني
      if (patientRealId) {
        const { error: recErr } = await supabase
          .from('medical_records')
          .insert([{
            patient_id: patientRealId,
            clinic_id: clinicId,
            visit_date: new Date().toISOString().split('T')[0],
            diagnosis: finalDiagnosis,
            prescriptions: prescribedMeds,
            qr_verification_code: 'VERIFY-' + patientRealCode,
            dynamic_fields: { 
              age, 
              gender, 
              chronicDiseases, 
              familyHistory, 
              symptoms: symptomsInput, 
              doctorNotes 
            }
          }]);

        if (recErr) throw new Error('خطأ في حفظ السجل الطبي: ' + recErr.message);
      }

      // 4️⃣ توليد وفتح الروشتة PDF
      await generatePrescriptionPDF(
        { name: patientName, phone: patientPhone, code: patientRealCode },
        finalDiagnosis,
        {
          'السن والنوع': `${age || 'غير محدد'} سنة (${gender})`,
          'الأمراض المزمنة': chronicDiseases || 'لا يوجد',
          'ملاحظات الفحوصات والأشعة': doctorNotes || 'لا يوجد'
        },
        prescribedMeds,
        {
          doctorName: clinicDoctorName,
          clinicName: clinicName,
          specialty: specialty,
          logoUrl: clinicLogoUrl
        }
      );

      // 5️⃣ إظهار رسالة النجاح وتنظيف المدخلات
      alert(`✅ تم الحفظ سحابياً واعتمدت الزيارة بنجاح!\nكود المريض للطلب: [${patientRealCode}]`);

      setPatientName('');
      setPatientPhone('');
      setAge('');
      setChronicDiseases('');
      setFamilyHistory('');
      setSymptomsInput('');
      setDoctorNotes('');
      setFinalDiagnosis('');
      setPrescribedMeds([]);
      setAiReport(null);

    } catch (error) {
      console.error('Detailed Save Error:', error);
      alert('❌ تعذر الحفظ: ' + (error.message || error));
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

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>⚙️ بيانات الطبيب والعيادة (تطبع أعلى الروشتة)</Text>
        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>اسم الطبيب</Text>
            <TextInput style={styles.input} value={clinicDoctorName} onChangeText={setClinicDoctorName} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>اسم العيادة</Text>
            <TextInput style={styles.input} value={clinicName} onChangeText={setClinicName} />
          </View>
        </View>
        
        <Text style={styles.label}>التخصص الطبي</Text>
        <TextInput style={styles.input} value={specialty} onChangeText={setSpecialty} />

        <Text style={styles.label}>رابط شعار / لوجو العيادة (Image URL)</Text>
        <TextInput 
          style={styles.input} 
          placeholder="https://example.com/logo.png" 
          placeholderTextColor="#94A3B8" 
          value={clinicLogoUrl} 
          onChangeText={setClinicLogoUrl} 
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionTitle}>👤 البيانات الأساسية لكارت المريض</Text>
          <TouchableOpacity style={styles.dummyBtn} onPress={handleFillDummyData}>
            <Text style={styles.dummyBtnText}>🧪 ملء بيانات تجريبية</Text>
          </TouchableOpacity>
        </View>
        
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
        <TextInput style={styles.input} placeholder="مثال: ضغط، سكر نوع ثاني..." placeholderTextColor="#94A3B8" value={chronicDiseases} onChangeText={setChronicDiseases} />

        <Text style={styles.label}>التاريخ المرضي العائلي</Text>
        <TextInput style={styles.input} placeholder="مثال: أمراض قلب..." placeholderTextColor="#94A3B8" value={familyHistory} onChangeText={setFamilyHistory} />
      </View>

      {searchingHistory && <ActivityIndicator color="#0284C7" style={{ marginBottom: 15 }} />}
      {patientHistory.length > 0 && (
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>📚 تاريخ الزيارات السابقة للمريض ({patientHistory.length} زيارات)</Text>
          {patientHistory.map((item, index) => (
            <View key={item.id || index} style={styles.historyItem}>
              <Text style={styles.historyDate}>📅 {new Date(item.created_at || item.visit_date).toLocaleDateString('ar-EG')}</Text>
              <Text style={styles.historyDiagnosis}><strong>التشخيص:</strong> {item.diagnosis || 'لا يوجد'}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🩺 الشكوى الحالية وملاحظات الفحوصات</Text>
        
        <Text style={styles.label}>الأعراض والشكوى الحالية:</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="صف الأعراض بالتفصيل..." placeholderTextColor="#94A3B8" multiline numberOfLines={3} value={symptomsInput} onChangeText={setSymptomsInput} />

        <Text style={styles.label}>ملاحظات الأشعة والتحاليل والمتابعة:</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="اكتب ملاحظات الفحوصات أو نتائج الأشعة..." placeholderTextColor="#94A3B8" multiline numberOfLines={2} value={doctorNotes} onChangeText={setDoctorNotes} />

        <TouchableOpacity style={styles.aiButton} onPress={handleClinicalAnalysis} disabled={analyzing}>
          {analyzing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.aiButtonText}>✨ تحليل الحالة بـ LLaMA 3.3 70B AI</Text>}
        </TouchableOpacity>

        {aiReport && (
          <View style={styles.aiReportBox}>
            <Text style={styles.aiReportHeader}>📋 التقرير الطبي المولد من الذكاء الاصطناعي:</Text>
            {aiReport.warnings && aiReport.warnings.length > 0 && (
              <View style={styles.warningBox}>
                {aiReport.warnings.map((w, idx) => <Text key={idx} style={styles.warningText}>⚠️ {w}</Text>)}
              </View>
            )}
            <Text style={styles.aiDiagText}><strong>التشخيص المقترح:</strong> {aiReport.diagnosis}</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📝 اعتماد الخطة العلاجية والروشتة</Text>

        <Text style={styles.label}>التشخيص المعتمد النهائي:</Text>
        <TextInput style={[styles.input, styles.textArea]} multiline value={finalDiagnosis} onChangeText={setFinalDiagnosis} />

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

        <View style={styles.addMedBox}>
          <Text style={styles.label}>إضافة دواء يدوي (مع فحص التفاعلات):</Text>
          <TextInput style={styles.input} placeholder="اسم الدواء (إنجليزي)" placeholderTextColor="#94A3B8" value={newMedName} onChangeText={setNewMedName} />
          <TextInput style={styles.input} placeholder="الجرعة والتوقيت" placeholderTextColor="#94A3B8" value={newMedDose} onChangeText={setNewMedDose} />
          <TextInput style={styles.input} placeholder="دواعي الاستعمال" placeholderTextColor="#94A3B8" value={newMedReason} onChangeText={setNewMedReason} />
          
          <TouchableOpacity style={styles.addMedBtn} onPress={handleCheckAndAddManualMed} disabled={checkingMed}>
            {checkingMed ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.addMedBtnText}>🔍 فحص وإضافة الدواء للروشتة</Text>}
          </TouchableOpacity>

          {medCheckError && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>🚨 تحذير تعارض: {medCheckError}</Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity style={[styles.saveButton, loading && styles.saveButtonDisabled]} onPress={handleSaveAndPrint} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>اعتماد التقرير وتنزيل الروشتة PDF 🖨️</Text>}
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
  cardHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dummyBtn: { backgroundColor: '#0284C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  dummyBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 6, textAlign: 'right' },
  subSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#38BDF8', marginTop: 12, marginBottom: 8, textAlign: 'right' },
  label: { fontSize: 12, color: '#CBD5E1', marginBottom: 4, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#475569', borderRadius: 8, padding: 10, backgroundColor: '#0F172A', marginBottom: 12, textAlign: 'right', color: '#FFFFFF', fontSize: 13 },
  rowInputs: { flexDirection: 'row-reverse' },
  textArea: { height: 70, textAlignVertical: 'top' },
  aiButton: { backgroundColor: '#0284C7', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  aiButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  aiReportBox: { backgroundColor: 'rgba(3, 105, 161, 0.3)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#0284C7' },
  aiReportHeader: { fontSize: 12, fontWeight: 'bold', color: '#38BDF8', marginBottom: 6, textAlign: 'right' },
  warningBox: { backgroundColor: 'rgba(153, 27, 27, 0.4)', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#EF4444', marginTop: 6, marginBottom: 6 },
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
 
