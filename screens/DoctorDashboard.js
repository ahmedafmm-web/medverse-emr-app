import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, ScrollView, 
  TouchableOpacity, Alert, ActivityIndicator, Platform, Image, Linking, Modal
} from 'react-native';
import { generatePrescriptionPDF } from '../components/PDFGenerator';
import { supabase } from '../supabaseClient';
import { verifyDoctorAccess } from '../src/services/subscriptionService';
import PrivacyPolicy from './PrivacyPolicy';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

const SPECIALITIES_LIST = [
  "استشاري أمراض القلب والباطنة",
  "استشاري أمراض الروماتيزم والروماتويد والأمراض المناعية",
  "استشاري طب الأطفال وحديثي الولادة",
  "استشاري جراحة العظام والمفاصل",
  "استشاري أمراض الباطنة والسكر"
];

// --- إحداثيات النقاط التفاعلية فوق صورة الهيكل العظمي الحقيقي ---
const SKELETON_HOTSPOTS = [
  { id: 'skull', label: 'الرأس', x: '49%', y: '8%' },
  { id: 'neck', label: 'الرقبة', x: '49%', y: '16%' },
  { id: 'shoulder_r', label: 'الكتف الأيمن', x: '35%', y: '22%' },
  { id: 'shoulder_l', label: 'الكتف الأيسر', x: '63%', y: '22%' },
  { id: 'elbow_r', label: 'الكوع الأيمن', x: '27%', y: '36%' },
  { id: 'elbow_l', label: 'الكوع الأيسر', x: '71%', y: '36%' },
  { id: 'wrist_r', label: 'الرسغ/اليد اليمنى', x: '21%', y: '48%' },
  { id: 'wrist_l', label: 'الرسغ/اليد اليسرى', x: '77%', y: '48%' },
  { id: 'spine', label: 'العمود الفقري', x: '49%', y: '32%' },
  { id: 'hip_r', label: 'الحوض الأيمن', x: '42%', y: '50%' },
  { id: 'hip_l', label: 'الحوض الأيسر', x: '56%', y: '50%' },
  { id: 'knee_r', label: 'الركبة اليمنى', x: '40%', y: '70%' },
  { id: 'knee_l', label: 'الركبة اليسرى', x: '58%', y: '70%' },
  { id: 'ankle_r', label: 'الكاحل/القدم اليمنى', x: '37%', y: '89%' },
  { id: 'ankle_l', label: 'الكاحل/القدم اليسرى', x: '61%', y: '89%' },
];

const RHEUMA_OPTIONS = {
  morningStiffnessDuration: ["دقائق", "نصف ساعة أو أكثر"],
  esrCrp: ["طبيعي (Normal)", "مرتفع بدرجة متوسطة (Moderate)", "مرتفع جداً (High Active Flare)"],
  rf: ["غير متوفر", "سلبي (Negative)", "إيجابي ضعيف (+)", "إيجابي مرتفع (+++)"],
  antiCCP: ["غير متوفر", "سلبي (Negative)", "إيجابي (+) < 3x", "إيجابي مرتفع (+++) > 3x"],
  ana: ["غير متوفر", "سلبي (Negative)", "إيجابي Homogeneous", "إيجابي Speckled", "إيجابي Nucleolar"],
  clinicalStage: [
    "حالة روماتويد أولي حديث التشخيص (Early RA - Treatment Naive)",
    "روماتويد مفصلي مزمن مستقر (Established RA in Remission/Low)",
    "نشاط روماتويدي حاد وفشل خط علاجي (Active RA Flare / DMARD Failure)",
    "اشتباه ذئبة حمراء جهازية (Suspected SLE)",
    "التهاب فقار لاصق / روماتيزم صدفي (Spondyloarthritis / PsA)",
    "متلازمة الجفاف المناعية (Sjögren's Syndrome)",
    "روماتيزم العضلات الليفي (Fibromyalgia with No Synovitis)",
    "خشونة مفاصل والتهاب أوتار ثانوي (Osteoarthritis / Tendinitis)"
  ]
};

const sanitizeText = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/[^\u0600-\u06FF a-zA-Z0-9.,()\-\:\/]/g, '').trim();
};

const isSpecialtyMatching = (selectedSpec, registeredSpec) => {
  if (!selectedSpec || !registeredSpec) return true;
  const cleanSelected = selectedSpec.replace(/[^\u0600-\u06FF a-zA-Z]/g, '').trim().toLowerCase();
  const cleanRegistered = registeredSpec.replace(/[^\u0600-\u06FF a-zA-Z]/g, '').trim().toLowerCase();
  if (cleanSelected === cleanRegistered) return true;
  const registeredWords = cleanRegistered.split(/\s+/).filter(word => word.length > 2 && !['استشاري', 'أخصائي', 'دكتور', 'طبيب', 'مركز', 'عيادة', 'الأمراض', 'وجراحة', 'جراحة'].includes(word));
  for (let word of registeredWords) {
    if (cleanSelected.includes(word)) return true;
  }
  return false;
};

const getExactTimeLeftMessage = (expiryDateString) => {
  if (!expiryDateString) return '';
  const now = new Date();
  const expiry = new Date(expiryDateString);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return 'منتهي الآن';
  const totalMins = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const minutes = totalMins % 60;
  if (days > 0) return `متبقي ${days} يوم و ${hours} ساعة و ${minutes} دقيقة`;
  else if (hours > 0) return `متبقي ${hours} ساعة و ${minutes} دقيقة فقط!`;
  else return `متبقي ${minutes} دقيقة فقط!`;
};

export default function DoctorDashboard({ specialty: initialSpecialty, onSwitchPortal, onUpdateSpecialty }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [subscriptionAccess, setSubscriptionAccess] = useState({ allowed: true, daysLeft: null, expiryDate: null, message: '', showAlert: false });
  const [dynamicTimeLeftText, setDynamicTimeLeftText] = useState('');

  const [activeTab, setActiveTab] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('medverse_doctor_active_tab') || 'prescription';
    }
    return 'prescription';
  });

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('medverse_doctor_active_tab', tabName);
    }
  };

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [clinicDoctorName, setClinicDoctorName] = useState('د. طاهر عبد الفتاح');
  const [clinicName, setClinicName] = useState('عيادة الروماتيزم والمفاصل والمناعة');
  const [specialty, setSpecialty] = useState(initialSpecialty || 'استشاري أمراض الروماتيزم والروماتويد والأمراض المناعية');
  const [registeredSpecialty, setRegisteredSpecialty] = useState('');
  const [clinicLogoUrl, setClinicLogoUrl] = useState('https://cdn-icons-png.flaticon.com/512/387/387561.png');
  const [digitalStampUrl, setDigitalStampUrl] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showMismatchModal, setShowMismatchModal] = useState(false);

  const [selectedScanFiles, setSelectedScanFiles] = useState([]);
  const [scanUploadProgress, setScanUploadProgress] = useState(0);
  const [uploadingScans, setUploadingScans] = useState(false);
  const [viewingImageModal, setViewingImageModal] = useState(null);

  // --- بيانات المريض الأساسية ---
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('ذكر');
  const [occupation, setOccupation] = useState('');
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [selectedPatientCode, setSelectedPatientCode] = useState('');
  const [currentPatientId, setCurrentPatientId] = useState(null);

  // --- خريطة الهيكل العظمي البصرية التفاعلية الفعلية ---
  // تخزين حالات المفاصل: { jointId: 'red' (التهاب) | 'blue' (ألم) | null }
  const [skeletonJointStates, setSkeletonJointStates] = useState({});
  const [rheumaStiffness, setRheumaStiffness] = useState('دقائق');

  const handleSkeletonHotspotClick = (jointId) => {
    setSkeletonJointStates(prev => {
      const current = prev[jointId];
      if (!current) return { ...prev, [jointId]: 'red' };        // نقرة 1: أحمر (التهاب/تورم Arthritis)
      if (current === 'red') return { ...prev, [jointId]: 'blue' }; // نقرة 2: أزرق (ألم فقط Arthralgia)
      const updated = { ...prev };
      delete updated[jointId];                                    // نقرة 3: إلغاء
      return updated;
    });
  };

  // --- الشكوى الرئيسية C/o ---
  const [coState, setCoState] = useState({
    generalized: false, acute: false, chronic: false, progressive: false, mechanical: false, inflammatory: false, arthralgia: false, arthritis: false
  });

  // --- الأعراض والتحاليل ---
  const [rheumaEsrCrp, setRheumaEsrCrp] = useState('مرتفع جداً (High Active Flare)');
  const [rheumaAntiCCP, setRheumaAntiCCP] = useState('إيجابي مرتفع (+++) > 3x');
  const [rheumaRF, setRheumaRF] = useState('إيجابي مرتفع (+++)');
  const [rheumaANA, setRheumaANA] = useState('غير متوفر');

  const [symptomsInput, setSymptomsInput] = useState('');
  const [scanGroupTitle, setScanGroupTitle] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [prescribedMeds, setPrescribedMeds] = useState([]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedReason, setNewMedReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [patientHistory, setPatientHistory] = useState([]);
  const [patientScansGrid, setPatientScansGrid] = useState([]);
  const [searchingHistory, setSearchingHistory] = useState(false);
  const [allDoctorPatients, setAllDoctorPatients] = useState([]);
  const [loadingPatientsList, setLoadingPatientsList] = useState(false);

  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [monthlyPatientsCount, setMonthlyPatientsCount] = useState(0);
  const [totalPatientsCount, setTotalPatientsCount] = useState(0);

  const isRheumaSpecialty = specialty.includes("الروماتيزم") || specialty.includes("الروماتويد") || specialty.includes("المناعية");

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
    else Alert.alert(title, message);
  };

  const handleOpenWhatsApp = () => {
    const userEmail = session?.user?.email || '';
    const message = `مرحباً دكتور، أود تفعيل اشتراكي في تطبيق MedVerse.\nالإيميل المسجل: ${userEmail}`;
    const url = `https://wa.me/201127834972?text=${encodeURIComponent(message)}`;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
  };

  const handleSendWhatsAppPrescription = () => {
    if (!patientPhone.trim()) {
      showAlert('تنبيه', 'يرجى إدخال رقم هاتف المريض أولاً.');
      return;
    }
    const cleanPhone = patientPhone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('2') ? cleanPhone : `2${cleanPhone}`;
    const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin.split('?')[0] : 'https://medverse-emr-suite.vercel.app';
    const message = `مرحباً ${patientName}،\nإليك رابط سجلـك الطبي وتقرير الأشعة الخاص بك لدى ${clinicDoctorName}:\n${baseUrl}?c=${selectedPatientCode}`;
    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session) {
        fetchDoctorProfile(session.user);
        checkSubscription(session.user);
        fetchAllPatients();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchDoctorProfile(session.user);
        checkSubscription(session.user);
        fetchAllPatients();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSubscription = async (user) => {
    const subStatus = await verifyDoctorAccess(user);
    setSubscriptionAccess(subStatus);
    if (subStatus.expiryDate) {
      setDynamicTimeLeftText(getExactTimeLeftMessage(subStatus.expiryDate));
    }
  };

  const compressImage = (file, maxWidth = 2400, quality = 0.92) => {
    return new Promise((resolve) => {
      try {
        if (!file || !file.type.includes('image')) return resolve(file);
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = objectUrl;
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      } catch (e) { resolve(file); }
    });
  };

  const handleDirectCameraCapture = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!currentPatientId && !selectedPatientCode) {
      showAlert('تنبيه هام', 'يجب حفظ بيانات المريض وتأكيد كوده أولاً قبل التقاط الأشعة بالكاميرا.');
      return;
    }

    setUploadingScans(true);
    try {
      const compressed = await compressImage(file, 2400, 0.92);
      const filePath = `patient_scans/${selectedPatientCode}/${Date.now()}_camera_direct.jpg`;

      const { error: uploadErr } = await supabase.storage.from('clinic-assets').upload(filePath, compressed, { upsert: true });
      let publicUrl = '';
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('clinic-assets').getPublicUrl(filePath);
        publicUrl = urlData?.publicUrl || `https://emynlqikbdwogijqfbfw.supabase.co/storage/v1/object/public/clinic-assets/${filePath}`;
      }

      const newScanObj = {
        id: Date.now(),
        title: scanGroupTitle || 'تحاليل وأشعة ومرفقات المريض (لقطة كاميرا)',
        url: publicUrl,
        created_at: new Date().toISOString()
      };

      await supabase.from('medical_records').insert([{
        patient_id: currentPatientId,
        doctor_email: session?.user?.email?.toLowerCase(),
        visit_date: new Date().toISOString().split('T')[0],
        diagnosis: scanGroupTitle ? `تحاليل وأشعة ومرفقات: ${scanGroupTitle}` : 'تحاليل وأشعة ومرفقات المريض (لقطة كاميرا)',
        dynamic_fields: { scans_list: [newScanObj] }
      }]);

      showAlert('تم التقاط الصورة والحفظ ✅', 'تم رفع الصورة المباشرة وربطها سحابياً بملف المريض.');
      if (currentPatientId) fetchPatientScansByPatientId(currentPatientId);
    } catch (err) {
      showAlert('خطأ', 'فشل حفظ لقطة الكاميرا: ' + err.message);
    } finally {
      setUploadingScans(false);
    }
  };

  const fetchPatientScansByPatientId = async (pId) => {
    if (!pId) return;
    setSearchingHistory(true);
    try {
      const { data: records, error } = await supabase.from('medical_records').select('*').eq('patient_id', pId).order('created_at', { ascending: false });
      if (error) throw error;
      setPatientHistory(records || []);

      let allScans = [];
      (records || []).forEach(r => {
        let df = r.dynamic_fields;
        if (typeof df === 'string') { try { df = JSON.parse(df); } catch (e) { df = {}; } }
        else { df = df || {}; }
        
        if (Array.isArray(df.scans_list)) {
          df.scans_list.forEach(sc => {
            const rawUrl = sc.url || sc.publicUrl;
            if (rawUrl) {
              allScans.push({ url: String(rawUrl), title: sc.title || 'أشعة وتحاليل', recordId: r.id, date: r.created_at });
            }
          });
        }
      });
      setPatientScansGrid(allScans);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingHistory(false);
    }
  };

  const handleSearchPatientByName = async (name) => {
    setPatientName(name);
    if (!name || name.trim().length < 2) {
      setPatientHistory([]);
      setPatientScansGrid([]);
      setSelectedPatientCode('');
      setCurrentPatientId(null);
      return;
    }

    try {
      const userEmail = session?.user?.email?.toLowerCase();
      const { data: patient } = await supabase.from('patients').select('id, patient_code, phone, age, gender').ilike('full_name', `%${name.trim()%}`).ilike('doctor_email', userEmail).maybeSingle();

      if (patient) {
        setSelectedPatientCode(patient.patient_code);
        setCurrentPatientId(patient.id);
        if (patient.phone) setPatientPhone(patient.phone);
        if (patient.age) setAge(String(patient.age));
        if (patient.gender) setGender(patient.gender);
        await fetchPatientScansByPatientId(patient.id);
      } else {
        setPatientHistory([]);
        setPatientScansGrid([]);
        setSelectedPatientCode('');
        setCurrentPatientId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDoctorProfile = async (user) => {
    try {
      const userEmail = user?.email?.toLowerCase();
      const { data: clinic } = await supabase.from('clinics').select('*').ilike('email', userEmail).limit(1).maybeSingle();
      if (clinic) {
        if (clinic.doctor_name) setClinicDoctorName(clinic.doctor_name);
        if (clinic.clinic_name) setClinicName(clinic.clinic_name);
        if (clinic.specialty) {
          setRegisteredSpecialty(clinic.specialty);
          if (!isSpecialtyMatching(initialSpecialty, clinic.specialty)) setShowMismatchModal(true);
          else setSpecialty(clinic.specialty);
        }
        if (clinic.logo_url) setClinicLogoUrl(clinic.logo_url);
        if (clinic.phone) setClinicPhone(clinic.phone);
        if (clinic.address) setClinicAddress(clinic.address);
      }
    } catch (e) { console.error(e); }
  };

  const fetchAllPatients = async () => {
    setLoadingPatientsList(true);
    try {
      const userEmail = session?.user?.email?.toLowerCase();
      const { data } = await supabase.from('patients').select('*').ilike('doctor_email', userEmail).order('created_at', { ascending: false });
      if (data) {
        setAllDoctorPatients(data);
        setTotalPatientsCount(data.length);
        const curM = new Date().getMonth(), curY = new Date().getFullYear();
        setMonthlyPatientsCount(data.filter(p => new Date(p.created_at).getMonth() === curM && new Date(p.created_at).getFullYear() === curY).length);
      }
    } catch (e) { console.error(e); } finally { setLoadingPatientsList(false); }
  };

  const selectPatientFromList = (patient) => {
    setPatientName(patient.full_name || '');
    setPatientPhone(patient.phone || '');
    setAge(patient.age ? String(patient.age) : '');
    setGender(patient.gender || 'ذكر');
    setSelectedPatientCode(patient.patient_code || '');
    setCurrentPatientId(patient.id);
    handleTabChange('prescription');
    fetchPatientScansByPatientId(patient.id);
  };

  const handleFillDummyData = () => {
    setPatientName('محمود عبد الفتاح');
    setPatientPhone('01098765432');
    setAge('52');
    setGender('ذكر');
    setOccupation('مهندس');
    setChronicDiseases('روماتويد مفصلي');
    setRheumaStiffness('نصف ساعة أو أكثر');
    setRheumaAntiCCP('إيجابي مرتفع (+++) > 3x');
    setRheumaRF('إيجابي مرتفع (+++)');
    setRheumaEsrCrp('مرتفع جداً (High Active Flare)');
    handleSearchPatientByName('محمود عبد الفتاح');
  };

  const handleClinicalAnalysis = async () => {
    if (!patientName.trim()) {
      showAlert('تنبيه', 'يرجى إدخال اسم المريض أولاً.');
      return;
    }
    setAnalyzing(true);
    setAiReport(null);

    const affectedJoints = Object.keys(skeletonJointStates).map(id => {
      const item = SKELETON_HOTSPOTS.find(h => h.id === id);
      return `${item?.label} (${skeletonJointStates[id] === 'red' ? 'ملتهب/تورم' : 'ألم فقط'})`;
    });

    const systemPrompt = `You are an expert AI Clinical Rheumatologist and Immunologist. Analyze case according to ACR/EULAR guidelines and return ONLY clean JSON:
{
  "diagnosis": "English Diagnosis - الشرح بالعربي",
  "warnings": ["تحذيرات إكلينيكية بالعربي"],
  "medications": [{"name": "Drug Name", "dose": "الجرعة", "reason": "دواعي الاستعمال"}]
}`;

    const userPrompt = `Patient: ${patientName}, Age: ${age}. Affected Joints from skeleton map: ${affectedJoints.join(', ') || 'None'}. Stiffness: ${rheumaStiffness}. ESR/CRP: ${rheumaEsrCrp}, RF: ${rheumaRF}, Anti-CCP: ${rheumaAntiCCP}.`;

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature: 0.2 })
      });
      const data = await res.json();
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}');
      setAiReport(parsed);
      if (parsed.diagnosis) setFinalDiagnosis(parsed.diagnosis);
      if (parsed.medications) setPrescribedMeds(parsed.medications);
    } catch (err) {
      showAlert('تنبيه', 'تعذر التحليل التلقائي، يمكنك كتابة التشخيص يدوياً.');
    } finally {
      setAnalyzing(false);
    }
  };

  const executeSaveAndPrint = async () => {
    setLoading(true);
    const generatedCode = selectedPatientCode || ('PAT-' + Math.floor(10000 + Math.random() * 90000));
    try {
      const userEmail = session?.user?.email?.toLowerCase();
      let clinicId = null;
      const { data: cData } = await supabase.from('clinics').select('id').ilike('email', userEmail).limit(1).maybeSingle();
      if (cData) clinicId = cData.id;

      let patientRealId = currentPatientId;
      if (!patientRealId) {
        const { data: pData } = await supabase.from('patients').insert([{
          full_name: patientName.trim(), phone: patientPhone, age: age ? parseInt(age) : null, gender, patient_code: generatedCode, clinic_id: clinicId, doctor_email: userEmail
        }]).select('id, patient_code').single();
        patientRealId = pData.id;
        setSelectedPatientCode(pData.patient_code);
      }
      setCurrentPatientId(patientRealId);

      await supabase.from('medical_records').insert([{
        patient_id: patientRealId, clinic_id: clinicId, doctor_email: userEmail, visit_date: new Date().toISOString().split('T')[0],
        diagnosis: finalDiagnosis, prescriptions: prescribedMeds, qr_verification_code: 'VERIFY-' + generatedCode,
        dynamic_fields: { age, gender, occupation, chronicDiseases, skeletonJointStates, rheumaStiffness, rheumaEsrCrp, rheumaAntiCCP, rheumaRF }
      }]);

      showAlert("نجاح الحفظ ✅", `تم حفظ التقرير وكود المريض [${generatedCode}] بنجاح!`);
      await generatePrescriptionPDF({ name: patientName, phone: patientPhone, code: generatedCode }, finalDiagnosis, { 'السن والنوع': `${age} سنة (${gender})`, 'التيبس': rheumaStiffness }, prescribedMeds, { doctorName: clinicDoctorName, clinicName, specialty, logoUrl: clinicLogoUrl, phone: clinicPhone, address: clinicAddress });
      fetchPatientScansByPatientId(patientRealId);
    } catch (err) {
      showAlert('خطأ', err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = allDoctorPatients.filter(p => p.full_name?.toLowerCase().includes(patientSearchQuery.toLowerCase()) || p.patient_code?.toLowerCase().includes(patientSearchQuery.toLowerCase()));

  if (authLoading) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#00F2FE" /></View>;

  if (!session) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ justifyContent: 'center', minHeight: '80%' }}>
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>MedVerse Doctor Portal 🔒</Text>
          <Text style={styles.authSub}>تسجيل دخول الطبيب</Text>
          <Text style={styles.label}>البريد الإلكتروني (Gmail)</Text>
          <TextInput style={styles.input} placeholder="doctor@gmail.com" placeholderTextColor="#94A3B8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.label}>كلمة السر</Text>
          <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="#94A3B8" value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={styles.authSubmitBtn} onPress={() => supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() })}>
            <Text style={styles.authSubmitBtnText}>تسجيل الدخول 🔐</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Lightbox Modal */}
      <Modal visible={!!viewingImageModal} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setViewingImageModal(null)}><Text style={{ color: '#FFF' }}>إغلاق ✕</Text></TouchableOpacity>
          {viewingImageModal && <Image source={{ uri: viewingImageModal.url }} style={{ width: 320, height: 320, resizeMode: 'contain' }} />}
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.topUserRow}>
          <Text style={styles.userEmailText}>⚡ {clinicDoctorName} ({session?.user?.email})</Text>
          <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.signOutBtn}><Text style={styles.signOutText}>خروج ✕</Text></TouchableOpacity>
        </View>
        <Text style={styles.title}>MedVerse Smart EMR Suite</Text>
        <Text style={styles.subtitle}>عيادة الروماتيزم والمناعة - خريطة الهيكل التفاعلية الفعلية</Text>
      </View>

      {/* Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity style={[styles.navBtn, activeTab === 'prescription' && styles.navBtnActive]} onPress={() => handleTabChange('prescription')}>
          <Text style={[styles.navBtnText, activeTab === 'prescription' && styles.navBtnTextActive]}>🩺 الكشف والفحص</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, activeTab === 'patients' && styles.navBtnActive]} onPress={() => { handleTabChange('patients'); fetchAllPatients(); }}>
          <Text style={[styles.navBtnText, activeTab === 'patients' && styles.navBtnTextActive]}>📂 قائمة المرضى ({totalPatientsCount})</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'patients' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📂 قائمة مرضى العيادة</Text>
          <TextInput style={styles.input} placeholder="بحث بالاسم أو الكود..." placeholderTextColor="#64748B" value={patientSearchQuery} onChangeText={setPatientSearchQuery} />
          {loadingPatientsList ? <ActivityIndicator color="#00F2FE" /> : filteredPatients.map(item => (
            <TouchableOpacity key={item.id} style={styles.patientListItem} onPress={() => selectPatientFromList(item)}>
              <Text style={styles.patientItemName}>👤 {item.full_name} ({item.patient_code})</Text>
              <Text style={styles.patientItemSub}>السن: {item.age || 'غير محدد'} | هاتف: {item.phone || 'لا يوجد'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeTab === 'prescription' && (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>👤 بيانات المريض الأساسية</Text>
              <TouchableOpacity style={styles.dummyBtn} onPress={handleFillDummyData}><Text style={styles.dummyBtnText}>🧪 بيانات تجريبية</Text></TouchableOpacity>
            </View>
            <Text style={styles.label}>اسم المريض بالكامل *</Text>
            <TextInput style={styles.input} placeholder="أدخل اسم المريض..." placeholderTextColor="#64748B" value={patientName} onChangeText={handleSearchPatientByName} />
            {selectedPatientCode ? <Text style={styles.selectedCodeBadge}>📌 كود المريض: {selectedPatientCode}</Text> : null}
            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginLeft: 8 }}><Text style={styles.label}>السن</Text><TextInput style={styles.input} placeholder="مثال: 40" placeholderTextColor="#64748B" keyboardType="numeric" value={age} onChangeText={setAge} /></View>
              <View style={{ flex: 1, marginLeft: 8 }}><Text style={styles.label}>الجنس</Text>
                <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
                  <TouchableOpacity style={[styles.genderChip, gender === 'ذكر' && styles.genderChipActive]} onPress={() => setGender('ذكر')}><Text style={{ color: '#FFF', fontSize: 11 }}>ذكر</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.genderChip, gender === 'أنثى' && styles.genderChipActive]} onPress={() => setGender('أنثى')}><Text style={{ color: '#FFF', fontSize: 11 }}>أنثى</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* 🦴 الخريطة البصرية التفاعلية لصورة الهيكل العظمي */}
          {isRheumaSpecialty && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>🦴 خريطة الهيكل العظمي التفاعلية (اضغط على المفصل في الصورة)</Text>
              <Text style={styles.legendTitle}>🔴 نقرة أولى = ملتهب ومتورم (Arthritis) | 🔵 نقرة ثانية = ألم فقط (Arthralgia) | ⚪ نقرة ثالثة = إلغاء التحديد</Text>

              <View style={styles.skeletonContainerBox}>
                {/* صورة الهيكل العظمي الأصلية كخلفية تفاعلية */}
                <Image 
                  source={{ uri: 'https://emynlqikbdwogijqfbfw.supabase.co/storage/v1/object/public/clinic-assets/skeleton_template.png' }} 
                  style={styles.skeletonBackgroundImage} 
                  resizeMode="contain"
                />

                {/* طبقة النقاط التفاعلية (Hotspots) فوق أماكن المفاصل في الصورة */}
                {SKELETON_HOTSPOTS.map(joint => {
                  const state = skeletonJointStates[joint.id];
                  return (
                    <TouchableOpacity
                      key={joint.id}
                      style={[
                        styles.hotspotBadge,
                        { top: joint.y, left: joint.x },
                        state === 'red' && styles.hotspotRed,
                        state === 'blue' && styles.hotspotBlue
                      ]}
                      onPress={() => handleSkeletonHotspotClick(joint.id)}
                    >
                      <Text style={styles.hotspotText}>{state === 'red' ? '🔴' : state === 'blue' ? '🔵' : '➕'}</Text>
                      <Text style={styles.hotspotLabel}>{joint.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.subSectionTitle}>⏱️ مدة التيبس الصباحي (Morning Stiffness):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.morningStiffnessDuration.map(stiff => (
                  <TouchableOpacity key={stiff} style={[styles.selectChip, rheumaStiffness === stiff && styles.selectChipActive]} onPress={() => setRheumaStiffness(stiff)}>
                    <Text style={[styles.selectChipText, rheumaStiffness === stiff && styles.selectChipTextActive]}>{stiff}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* التحاليل والمرفقات */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📸 التحاليل والأشعة والمرفقات</Text>
            <Text style={styles.label}>سرعة الترسيب والبروتين (ESR / CRP):</Text>
            <View style={styles.chipsContainer}>
              {RHEUMA_OPTIONS.esrCrp.map(opt => (
                <TouchableOpacity key={opt} style={[styles.selectChip, rheumaEsrCrp === opt && styles.selectChipActive]} onPress={() => setRheumaEsrCrp(opt)}>
                  <Text style={[styles.selectChipText, rheumaEsrCrp === opt && styles.selectChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.subSectionTitle}>📷 كاميرا الأشعة المباشرة:</Text>
            {Platform.OS === 'web' && <input type="file" accept="image/*" capture="environment" onChange={handleDirectCameraCapture} style={{ color: '#00F2FE', marginBottom: 10 }} />}

            {patientScansGrid.length > 0 && (
              <View style={styles.scansGridContainer}>
                {patientScansGrid.map((sc, idx) => (
                  <View key={idx} style={styles.scanGridCard}>
                    <TouchableOpacity onPress={() => setViewingImageModal(sc)}><Image source={{ uri: sc.url }} style={{ width: 70, height: 70, borderRadius: 6 }} /></TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* التشخيص والأدوية */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📝 التشخيص والروشتة</Text>
            <TouchableOpacity style={styles.aiButton} onPress={handleClinicalAnalysis} disabled={analyzing}>
              {analyzing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.aiButtonText}>✨ تحليل الحالة بالذكاء الاصطناعي</Text>}
            </TouchableOpacity>

            <Text style={styles.label}>التشخيص النهائي:</Text>
            <TextInput style={[styles.input, styles.textArea]} multiline value={finalDiagnosis} onChangeText={setFinalDiagnosis} />

            <Text style={styles.subSectionTitle}>💊 الأدوية ({prescribedMeds.length}):</Text>
            {prescribedMeds.map((med, idx) => (
              <View key={idx} style={styles.medCard}>
                <Text style={styles.medName}>💊 {med.name} - {med.dose}</Text>
                <Text style={styles.medDetail}>{med.reason}</Text>
              </View>
            ))}

            <View style={styles.addMedBox}>
              <Text style={styles.label}>إضافة دواء يدوي:</Text>
              <TextInput style={styles.input} placeholder="اسم الدواء..." placeholderTextColor="#64748B" value={newMedName} onChangeText={setNewMedName} />
              <TextInput style={styles.input} placeholder="الجرعة..." placeholderTextColor="#64748B" value={newMedDose} onChangeText={setNewMedDose} />
              <TouchableOpacity style={styles.addMedBtn} onPress={() => { setPrescribedMeds(p => [...p, { name: newMedName, dose: newMedDose, reason: newMedReason || 'إضافة مباشرة' }]); setNewMedName(''); setNewMedDose(''); }}><Text style={styles.addMedBtnText}>➕ إضافة للروشتة</Text></TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={executeSaveAndPrint} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>اعتماد التقرير وتنزيل الروشتة PDF 🖨️</Text>}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060911', padding: 14 },
  header: { marginBottom: 15, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: '#00F2FE', textAlign: 'center' },
  subtitle: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 4 },
  topUserRow: { flexDirection: 'row-reverse', justifyContent: 'space-width', width: '100%', marginBottom: 8 },
  userEmailText: { color: '#38BDF8', fontSize: 11, fontWeight: 'bold' },
  signOutBtn: { backgroundColor: '#1E293B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  signOutText: { color: '#EF4444', fontSize: 10, fontWeight: 'bold' },
  navBar: { flexDirection: 'row-reverse', backgroundColor: '#0F172A', borderRadius: 12, padding: 4, marginBottom: 15 },
  navBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  navBtnActive: { backgroundColor: '#0284C7' },
  navBtnText: { color: '#94A3B8', fontSize: 11, fontWeight: 'bold' },
  navBtnTextActive: { color: '#FFFFFF' },
  card: { backgroundColor: '#0F172A', padding: 16, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1E293B' },
  cardHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 10, textAlign: 'right' },
  subSectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#38BDF8', marginTop: 12, marginBottom: 8, textAlign: 'right' },
  label: { fontSize: 11, color: '#CBD5E1', marginBottom: 6, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#1E293B', borderRadius: 10, padding: 10, backgroundColor: '#060911', marginBottom: 10, textAlign: 'right', color: '#FFFFFF', fontSize: 12 },
  rowInputs: { flexDirection: 'row-reverse' },
  textArea: { height: 60, textAlignVertical: 'top' },
  chipsContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  selectChip: { backgroundColor: '#060911', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#1E293B' },
  selectChipActive: { backgroundColor: '#0284C7', borderColor: '#00F2FE' },
  selectChipText: { color: '#94A3B8', fontSize: 11 },
  selectChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  genderChip: { flex: 1, padding: 6, borderRadius: 6, backgroundColor: '#060911', alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  genderChipActive: { backgroundColor: '#0284C7' },
  dummyBtn: { backgroundColor: '#0284C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dummyBtnText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  selectedCodeBadge: { color: '#10B981', fontSize: 11, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 },

  /* تنسيق خريطة الهيكل العظمي البصرية الفعلية */
  skeletonContainerBox: { width: '100%', height: 380, backgroundColor: '#FFFFFF', borderRadius: 12, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#0284C7', marginBottom: 10 },
  skeletonBackgroundImage: { width: '100%', height: '100%', position: 'absolute' },
  legendTitle: { color: '#CBD5E1', fontSize: 10, textAlign: 'right', marginBottom: 8 },
  hotspotBadge: { position: 'absolute', transform: [{ translateX: -14 }, { translateY: -14 }], backgroundColor: 'rgba(15, 23, 42, 0.85)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#38BDF8', alignItems: 'center', zIndex: 10 },
  hotspotRed: { backgroundColor: 'rgba(239, 68, 68, 0.9)', borderColor: '#F87171' },
  hotspotBlue: { backgroundColor: 'rgba(59, 130, 246, 0.9)', borderColor: '#60A5FA' },
  hotspotText: { fontSize: 9 },
  hotspotLabel: { fontSize: 8, color: '#FFF', fontWeight: 'bold', marginTop: 1 },

  scansGridContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  scanGridCard: { backgroundColor: '#060911', padding: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  aiButton: { backgroundColor: '#0284C7', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  aiButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  medCard: { backgroundColor: '#060911', padding: 10, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#1E293B' },
  medName: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  medDetail: { color: '#94A3B8', fontSize: 11, textAlign: 'right', marginTop: 2 },
  addMedBox: { backgroundColor: '#060911', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#1E293B' },
  addMedBtn: { backgroundColor: '#1E293B', padding: 8, borderRadius: 6, alignItems: 'center', marginTop: 6 },
  addMedBtnText: { color: '#00F2FE', fontSize: 11, fontWeight: 'bold' },
  saveButton: { backgroundColor: '#10B981', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 30 },
  saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  statsContainer: { flexDirection: 'row-reverse', gap: 10, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#060911', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#0284C7' },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#00F2FE' },
  statLabel: { fontSize: 10, color: '#94A3B8' },
  patientListItem: { backgroundColor: '#060911', padding: 10, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#1E293B' },
  patientItemName: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  patientItemSub: { color: '#94A3B8', fontSize: 10, textAlign: 'right', marginTop: 2 },
  authCard: { backgroundColor: '#0F172A', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1E293B' },
  authTitle: { fontSize: 18, fontWeight: 'bold', color: '#00F2FE', textAlign: 'center', marginBottom: 5 },
  authSub: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 15 },
  authSubmitBtn: { backgroundColor: '#0284C7', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  authSubmitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  lightboxCloseBtn: { position: 'absolute', top: 20, right: 20, backgroundColor: '#EF4444', padding: 8, borderRadius: 6 }
});
