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

// --- مفاصل الجسم المتاحة للنقر البصري على الهيكل العظمي ---
const SKELETON_JOINTS = [
  { id: 'skull', label: 'الرأس والجمجمة', top: '5%', left: '46%' },
  { id: 'shoulder_r', label: 'الكتف الأيمن', top: '18%', left: '30%' },
  { id: 'shoulder_l', label: 'الكتف الأيسر', top: '18%', left: '65%' },
  { id: 'elbow_r', label: 'الكوع الأيمن', top: '30%', left: '23%' },
  { id: 'elbow_l', label: 'الكوع الأيسر', top: '30%', left: '72%' },
  { id: 'wrist_r', label: 'الرسغ/اليد اليمنى', top: '42%', left: '18%' },
  { id: 'wrist_l', label: 'الرسغ/اليد اليسرى', top: '42%', left: '77%' },
  { id: 'spine', label: 'العمود الفقري والظهر', top: '28%', left: '48%' },
  { id: 'hip_r', label: 'الحوض الأيمن', top: '45%', left: '40%' },
  { id: 'hip_l', label: 'الحوض الأيسر', top: '45%', left: '57%' },
  { id: 'knee_r', label: 'الركبة اليمنى', top: '65%', left: '38%' },
  { id: 'knee_l', label: 'الركبة اليسرى', top: '65%', left: '59%' },
  { id: 'ankle_r', label: 'الكاحل/القدم اليمنى', top: '85%', left: '36%' },
  { id: 'ankle_l', label: 'الكاحل/القدم اليسرى', top: '85%', left: '61%' },
];

const RHEUMA_OPTIONS = {
  morningStiffnessDuration: [
    "دقائق",
    "نصف ساعة أو أكثر"
  ],
  esrCrp: [
    "طبيعي (Normal)",
    "مرتفع بدرجة متوسطة (Moderate)",
    "مرتفع جداً (High Active Flare)"
  ],
  rf: [
    "غير متوفر",
    "سلبي (Negative)",
    "إيجابي ضعيف (+)",
    "إيجابي مرتفع (+++)"
  ],
  antiCCP: [
    "غير متوفر",
    "سلبي (Negative)",
    "إيجابي (+) < 3x",
    "إيجابي مرتفع (+++) > 3x"
  ],
  ana: [
    "غير متوفر",
    "سلبي (Negative)",
    "إيجابي Homogeneous",
    "إيجابي Speckled",
    "إيجابي Nucleolar"
  ],
  clinicalStage: [
    "حالة روماتويد أولي حديث التشخيص (Early RA - Treatment Naive)",
    "روماتويد مفصلي مزمن مستقر (Established RA in Remission/Low)",
    "نشاط روماتويدي حاد وفشل خط علاجي (Active RA Flare / DMARD Failure)",
    "اشتباه ذئبة حمراء جهازية (Suspected SLE)",
    "التهاب فقار لاصق / روماتيزم صدفي (Spondyloarthritis / PsA)",
    "متلازمة الجفاف المناعية (Sjögren's Syndrome)",
    "روماتيزم العضلات الليفي (Fibromyalgia with No Synovitis)",
    "خشونة مفاصل والتهاب أوتار ثانوي (Osteoarthritis / Tendinitis)",
    "تشخيص محتمل حتى الآن (Query Diagnosis)"
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
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
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
  const [clinicName, setClinicName] = useState('عيادة الروماتيزم والمفاصل');
  const [specialty, setSpecialty] = useState(initialSpecialty || 'استشاري أمراض الروماتيزم والروماتويد والأمراض المناعية');
  const [registeredSpecialty, setRegisteredSpecialty] = useState('');
  const [clinicLogoUrl, setClinicLogoUrl] = useState('https://cdn-icons-png.flaticon.com/512/387/387561.png');
  const [digitalStampUrl, setDigitalStampUrl] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');

  const [logoUploadProgress, setLogoUploadProgress] = useState(0);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showMismatchModal, setShowMismatchModal] = useState(false);

  const [selectedScanFiles, setSelectedScanFiles] = useState([]);
  const [scanUploadProgress, setScanUploadProgress] = useState(0);
  const [uploadingScans, setUploadingScans] = useState(false);
  const [viewingImageModal, setViewingImageModal] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);

  // --- بيانات المريض الأساسية ---
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('ذكر');
  const [occupation, setOccupation] = useState('');
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [selectedPatientCode, setSelectedPatientCode] = useState('');
  const [currentPatientId, setCurrentPatientId] = useState(null);

  // --- خريطة الهيكل العظمي التفاعلية (الصورة الحقيقية المضمنة بالنقر) ---
  const [skeletonJointStates, setSkeletonJointStates] = useState({}); // { jointId: 'red' | 'blue' | null }
  const [rheumaStiffness, setRheumaStiffness] = useState('دقائق');

  const handleSkeletonPointClick = (jointId) => {
    setSkeletonJointStates(prev => {
      const current = prev[jointId];
      if (!current) return { ...prev, [jointId]: 'red' };        // نقرة 1: أحمر (التهاب / تورم)
      if (current === 'red') return { ...prev, [jointId]: 'blue' }; // نقرة 2: أزرق (ألم فقط)
      const updated = { ...prev };
      delete updated[jointId];                                    // نقرة 3: إلغاء التحديد
      return updated;
    });
  };

  // --- الشكوى الرئيسية C/o ---
  const [coState, setCoState] = useState({
    generalized: false, acute: false, chronic: false, progressive: false, mechanical: false, inflammatory: false, arthralgia: false, arthritis: false
  });

  // --- الأعراض الإضافية والأنظمة ---
  const [symptomsFlags, setSymptomsFlags] = useState({
    lbpMech: false, lbpInfl: false, rashes: false, oralUlcers: false, eye: false,
    dysphagia: false, recurrentDiarrhea: false, bloodyDiarrhea: false, abdominalPain: false,
    constipation: false, cyanosis: false, tightSkin: false, skinNailChanges: false,
    dysuria: false, menstrRegular: true, recurrentAbortions: false, recurrentFever: false,
    weightLoss: false, lossOfAppetite: false, lymphNodes: false
  });

  const [familyHistory, setFamilyHistory] = useState({ consang: false, autoimDs: false, chemother: false, tb: false, feverHospital: false });

  // --- التحاليل ---
  const [rheumaEsrCrp, setRheumaEsrCrp] = useState('مرتفع جداً (High Active Flare)');
  const [rheumaAntiCCP, setRheumaAntiCCP] = useState('إيجابي مرتفع (+++) > 3x');
  const [rheumaRF, setRheumaRF] = useState('إيجابي مرتفع (+++)');
  const [rheumaANA, setRheumaANA] = useState('غير متوفر');
  const [rheumaClinicalStage, setRheumaClinicalStage] = useState('حالة روماتويد أولي حديث التشخيص (Early RA - Treatment Naive)');

  const [symptomsInput, setSymptomsInput] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [scanGroupTitle, setScanGroupTitle] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [checkingMed, setCheckingMed] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [medCheckError, setMedCheckError] = useState(null);
  const [pendingMed, setPendingMed] = useState(null);

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

  // إحصائيات المرضى
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

  const handleOpenInstaPay = () => {
    const url = 'https://ipn.eg/S/eg2400020548054885193/instapay/5xBjGv';
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

  useEffect(() => {
    if (!subscriptionAccess.expiryDate) return;
    setDynamicTimeLeftText(getExactTimeLeftMessage(subscriptionAccess.expiryDate));
    const timer = setInterval(() => {
      setDynamicTimeLeftText(getExactTimeLeftMessage(subscriptionAccess.expiryDate));
    }, 30000);
    return () => clearInterval(timer);
  }, [subscriptionAccess.expiryDate]);

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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      } catch (e) { resolve(file); }
    });
  };

  const handleSelectMultipleScans = (event) => {
    const files = Array.from(event.target.files);
    if (!files || files.length === 0) return;
    const newFiles = files.map((file, idx) => ({
      id: Date.now() + '_' + idx,
      file: file,
      previewUrl: URL.createObjectURL(file),
      title: scanGroupTitle || file.name,
    }));
    setSelectedScanFiles(prev => [...prev, ...newFiles]);
  };

  // --- كاميرا الأشعة والمرفقات المباشرة ---
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

      const { error: uploadErr } = await supabase.storage
        .from('clinic-assets')
        .upload(filePath, compressed, { upsert: true });

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
      const { data: records, error } = await supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', pId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatientHistory(records || []);

      let allScans = [];
      (records || []).forEach(r => {
        let df = r.dynamic_fields;
        if (typeof df === 'string') {
          try { df = JSON.parse(df); } catch (e) { df = {}; }
        } else {
          df = df || {};
        }
        
        if (Array.isArray(df.scans_list)) {
          df.scans_list.forEach(sc => {
            const rawUrl = sc.url || sc.publicUrl || sc.publicURL;
            if (rawUrl) {
              allScans.push({ 
                url: String(rawUrl), 
                title: sc.title || 'تحاليل وأشعة ومرفقات المريض', 
                recordId: r.id, 
                date: r.created_at || r.visit_date 
              });
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
      const { data: patient } = await supabase
        .from('patients')
        .select('id, patient_code, phone, age, gender')
        .ilike('full_name', `%${name.trim()}%`)
        .ilike('doctor_email', userEmail)
        .maybeSingle();

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

  const handleSaveScansToPatientFile = async () => {
    if (!patientName.trim()) {
      showAlert('تنبيه', 'يرجى إدخال اسم المريض أولاً.');
      return;
    }
    if (!currentPatientId && !selectedPatientCode) {
      showAlert('تنبيه هام', 'يجب حفظ بيانات المريض وتأكيد كوده أولاً قبل إضافة الأشعات.');
      return;
    }
    if (selectedScanFiles.length === 0) {
      showAlert('تنبيه', 'يرجى اختيار صور الأشعة.');
      return;
    }

    setUploadingScans(true);
    setScanUploadProgress(10);

    try {
      const userEmail = session?.user?.email?.toLowerCase();
      let patientCode = selectedPatientCode;
      let patientId = currentPatientId;
      let clinicId = null;

      const { data: existingClinic } = await supabase.from('clinics').select('id').ilike('email', userEmail).limit(1).maybeSingle();
      if (existingClinic) clinicId = existingClinic.id;

      const uploadedList = [];
      for (let i = 0; i < selectedScanFiles.length; i++) {
        const item = selectedScanFiles[i];
        const compressed = await compressImage(item.file, 2400, 0.92);
        const filePath = `patient_scans/${patientCode}/${Date.now()}_${i}.jpg`;

        const { error: uploadErr } = await supabase.storage.from('clinic-assets').upload(filePath, compressed, { upsert: true });
        let publicUrl = uploadErr ? item.previewUrl : supabase.storage.from('clinic-assets').getPublicUrl(filePath).data.publicUrl;

        uploadedList.push({
          id: Date.now() + '_' + i,
          title: item.title || scanGroupTitle || 'تحاليل وأشعة ومرفقات المريض',
          url: publicUrl,
          created_at: new Date().toISOString()
        });
        setScanUploadProgress(Math.round(((i + 1) / selectedScanFiles.length) * 100));
      }

      await supabase.from('medical_records').insert([{
        patient_id: patientId,
        clinic_id: clinicId,
        doctor_email: userEmail,
        visit_date: new Date().toISOString().split('T')[0],
        diagnosis: scanGroupTitle ? `أشعة وفحوصات: ${scanGroupTitle}` : 'تحاليل وأشعة ومرفقات المريض',
        qr_verification_code: 'VERIFY-' + patientCode,
        dynamic_fields: { scans_list: uploadedList }
      }]);

      showAlert('تم الحفظ بنجاح ✅', `تم حفظ (${uploadedList.length}) صورة في ملف المريض.`);
      setSelectedScanFiles([]);
      setScanGroupTitle('');
      await fetchPatientScansByPatientId(patientId);
    } catch (err) {
      showAlert('خطأ', err.message);
    } finally {
      setUploadingScans(false);
    }
  };

  const handleDeleteSavedScanFromRecord = async (recordId, scanUrl) => {
    if (Platform.OS === 'web' && !window.confirm("هل أنت متأكد من حذف الصورة؟")) return;
    try {
      const record = patientHistory.find(r => r.id === recordId);
      if (!record || !record.dynamic_fields) return;
      const df = typeof record.dynamic_fields === 'string' ? JSON.parse(record.dynamic_fields) : record.dynamic_fields;
      const updatedScans = (df.scans_list || []).filter(s => s.url !== scanUrl);
      
      await supabase.from('medical_records').update({ dynamic_fields: { ...df, scans_list: updatedScans } }).eq('id', recordId);
      showAlert('تم الحذف', 'تم حذف الصورة من السجل.');
      if (currentPatientId) fetchPatientScansByPatientId(currentPatientId);
    } catch (err) {
      showAlert('خطأ', err.message);
    }
  };

  const handleUploadLogoFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    setLogoUploadProgress(10);
    try {
      const compressedBlob = await compressImage(file, 1000, 0.9);
      const filePath = `logos/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('clinic-assets').upload(filePath, compressedBlob, { upsert: true });
      if (!error) {
        setClinicLogoUrl(supabase.storage.from('clinic-assets').getPublicUrl(filePath).data.publicUrl);
      }
    } catch (err) {
      showAlert('خطأ', err.message);
    } finally {
      setUploadingLogo(false);
      setLogoUploadProgress(100);
    }
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('تنبيه', 'يرجى إدخال البريد الإلكتروني وكلمة السر.');
      return;
    }
    setAuthSubmitting(true);
    try {
      if (isSigningUp) {
        await supabase.auth.signUp({ email: email.trim(), password: password.trim() });
        await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
        if (error) throw error;
      }
    } catch (err) {
      showAlert('خطأ', err.message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleCopyPortalLink = async () => {
    try {
      const userEmail = session?.user?.email?.toLowerCase();
      const { data: clinic } = await supabase.from('clinics').select('id').ilike('email', userEmail).limit(1).maybeSingle();
      const portalUrl = `https://medverse-emr-suite.vercel.app?c=${encodeURIComponent(clinic?.id || userEmail)}`;
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(portalUrl);
        showAlert('تم النسخ بنجاح! 📋', portalUrl);
      } else {
        showAlert('رابط العيادة', portalUrl);
      }
    } catch (err) {
      showAlert('خطأ', 'تعذر النسخ.');
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

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const userEmail = session?.user?.email?.toLowerCase();
      const { data: existing } = await supabase.from('clinics').select('id').ilike('email', userEmail).limit(1).maybeSingle();
      const payload = { doctor_name: clinicDoctorName, clinic_name: clinicName, specialty, logo_url: clinicLogoUrl, phone: clinicPhone, address: clinicAddress, email: userEmail };
      if (existing) await supabase.from('clinics').update(payload).eq('id', existing.id);
      else await supabase.from('clinics').insert([payload]);
      setShowMismatchModal(false);
      showAlert('تم الحفظ', 'تم حفظ وتحديث البروفايل بنجاح!');
    } catch (err) {
      showAlert('خطأ', err.message);
    } finally {
      setLoading(false);
    }
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
    setOccupation('محاسب');
    setChronicDiseases('روماتويد مفصلي');
    setRheumaStiffness('نصف ساعة أو أكثر');
    setRheumaAntiCCP('إيجابي مرتفع (+++) > 3x');
    setRheumaRF('إيجابي مرتفع (+++)');
    setRheumaEsrCrp('مرتفع جداً (High Active Flare)');
    handleSearchPatientByName('محمود عبد الفتاح');
  };

  // --- التحليل الإكلينيكي بالذكاء الاصطناعي ---
  const handleClinicalAnalysis = async () => {
    if (!patientName.trim()) {
      showAlert('تنبيه', 'يرجى إدخال اسم المريض أولاً.');
      return;
    }
    setAnalyzing(true);
    setAiReport(null);

    const affectedJointsList = Object.keys(skeletonJointStates).map(id => {
      const j = SKELETON_JOINTS.find(item => item.id === id);
      return `${j?.label} (${skeletonJointStates[id] === 'red' ? 'ملتهب/تورم' : 'ألم فقط'})`;
    });

    const systemPrompt = `You are an expert AI Clinical Rheumatologist and Immunologist. Analyze the case according to ACR/EULAR guidelines and respond ONLY with clean JSON:
{
  "diagnosis": "English Diagnosis - الشرح بالعربي",
  "warnings": ["تحذيرات إكلينيكية بالعربي"],
  "medications": [{"name": "Drug Name", "dose": "الجرعة", "reason": "دواعي الاستعمال"}]
}`;

    const userPrompt = `Patient: ${patientName}, Age: ${age}, Gender: ${gender}. Affected Joints from map: ${affectedJointsList.join(', ') || 'None'}. Stiffness: ${rheumaStiffness}. ESR/CRP: ${rheumaEsrCrp}, RF: ${rheumaRF}, Anti-CCP: ${rheumaAntiCCP}.`;

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

  const handleCheckAndAddManualMed = async () => {
    if (!newMedName.trim() || !newMedDose.trim()) {
      showAlert('تنبيه', 'أدخل اسم الدواء والجرعة.');
      return;
    }
    setPrescribedMeds(prev => [...prev, { name: newMedName, dose: newMedDose, reason: newMedReason || 'إضافة مباشرة' }]);
    setNewMedName(''); setNewMedDose(''); setNewMedReason('');
  };

  const handleRemoveMed = (index) => {
    setPrescribedMeds(prev => prev.filter((_, i) => i !== index));
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

  const handleSaveAndPrint = () => {
    if (!patientName.trim()) {
      showAlert('تنبيه', 'يرجى إدخال اسم المريض أولاً.');
      return;
    }
    executeSaveAndPrint();
  };

  const isPatientSavedInDb = Boolean(currentPatientId || selectedPatientCode);
  const filteredPatients = allDoctorPatients.filter(p => p.full_name?.toLowerCase().includes(patientSearchQuery.toLowerCase()) || p.patient_code?.toLowerCase().includes(patientSearchQuery.toLowerCase()));

  if (authLoading) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#00F2FE" /></View>;

  if (!session) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ justifyContent: 'center', minHeight: '80%' }}>
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>MedVerse Doctor Portal 🔒</Text>
          <Text style={styles.authSub}>{isSigningUp ? 'إنشاء حساب طبيب جديد' : 'تسجيل دخول الطبيب'}</Text>
          <Text style={styles.label}>البريد الإلكتروني (Gmail)</Text>
          <TextInput style={styles.input} placeholder="doctor@gmail.com" placeholderTextColor="#94A3B8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.label}>كلمة السر</Text>
          <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="#94A3B8" value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={styles.authSubmitBtn} onPress={handleAuth} disabled={authSubmitting}>
            {authSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.authSubmitBtnText}>{isSigningUp ? 'إنشاء حساب جديد ✨' : 'تسجيل الدخول 🔐'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.authToggleBtn} onPress={() => setIsSigningUp(!isSigningUp)}>
            <Text style={styles.authToggleBtnText}>{isSigningUp ? 'لديك حساب بالفعل؟ سجل دخولك' : 'ليس لديك حساب؟ أنشئ حساب جديد'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (!subscriptionAccess.allowed) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ justifyContent: 'center', paddingVertical: 20 }}>
        <View style={styles.paywallCard}>
          <Text style={styles.paywallIcon}>🔒</Text>
          <Text style={styles.paywallTitle}>تنبيه اشتراك التطبيق</Text>
          <Text style={styles.paywallReason}>{subscriptionAccess.message}</Text>
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleOpenWhatsApp}>
            <Text style={styles.whatsappBtnText}>💬 التواصل مع الدعم عبر الواتساب لتفعيل الحساب</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut}><Text style={{ color: '#EF4444', textAlign: 'center', marginTop: 10 }}>تسجيل الخروج ✕</Text></TouchableOpacity>
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
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}><Text style={styles.signOutText}>خروج ✕</Text></TouchableOpacity>
        </View>
        <Text style={styles.title}>MedVerse Smart EMR Suite</Text>
        <Text style={styles.subtitle}>عيادة المفاصل والروماتيزم والمناعة (نموذج د. طاهر عبد الفتاح)</Text>
      </View>

      {/* Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity style={[styles.navBtn, activeTab === 'prescription' && styles.navBtnActive]} onPress={() => handleTabChange('prescription')}>
          <Text style={[styles.navBtnText, activeTab === 'prescription' && styles.navBtnTextActive]}>🩺 الكشف والفحص الإكلينيكي</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, activeTab === 'patients' && styles.navBtnActive]} onPress={() => { handleTabChange('patients'); fetchAllPatients(); }}>
          <Text style={[styles.navBtnText, activeTab === 'patients' && styles.navBtnTextActive]}>📂 قائمة المرضى ({totalPatientsCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, activeTab === 'profile' && styles.navBtnActive]} onPress={() => handleTabChange('profile')}>
          <Text style={[styles.navBtnText, activeTab === 'profile' && styles.navBtnTextActive]}>⚙️ بروفايل العيادة</Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: PROFILE */}
      {activeTab === 'profile' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>⚙️ بيانات الطبيب والعيادة</Text>
          <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyPortalLink}><Text style={styles.copyLinkBtnText}>📋 نسخ رابط العيادة للمرضى</Text></TouchableOpacity>
          <Text style={styles.label}>اسم الطبيب</Text>
          <TextInput style={styles.input} value={clinicDoctorName} onChangeText={setClinicDoctorName} />
          <Text style={styles.label}>اسم العيادة</Text>
          <TextInput style={styles.input} value={clinicName} onChangeText={setClinicName} />
          <Text style={styles.label}>التخصص</Text>
          <TextInput style={styles.input} value={specialty} onChangeText={setSpecialty} />
          <Text style={styles.label}>الهاتف</Text>
          <TextInput style={styles.input} value={clinicPhone} onChangeText={setClinicPhone} />
          <Text style={styles.label}>العنوان</Text>
          <TextInput style={styles.input} value={clinicAddress} onChangeText={setClinicAddress} />
          <TouchableOpacity style={styles.saveProfileBtn} onPress={handleSaveProfile}><Text style={styles.saveProfileBtnText}>💾 حفظ البروفايل</Text></TouchableOpacity>
        </View>
      )}

      {/* TAB 2: PATIENTS */}
      {activeTab === 'patients' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📂 قائمة مرضى العيادة</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}><Text style={styles.statNumber}>{monthlyPatientsCount}</Text><Text style={styles.statLabel}>مرضى الشهر</Text></View>
            <View style={styles.statCard}><Text style={styles.statNumber}>{totalPatientsCount}</Text><Text style={styles.statLabel}>إجمالي المرضى</Text></View>
          </View>
          <Text style={styles.label}>🔍 بحث منفصل باسم المريض أو الكود:</Text>
          <TextInput style={styles.input} placeholder="اكتب اسم المريض للبحث..." placeholderTextColor="#64748B" value={patientSearchQuery} onChangeText={setPatientSearchQuery} />
          {loadingPatientsList ? <ActivityIndicator color="#00F2FE" /> : filteredPatients.map(item => (
            <TouchableOpacity key={item.id} style={styles.patientListItem} onPress={() => selectPatientFromList(item)}>
              <Text style={styles.patientItemName}>👤 {item.full_name} ({item.patient_code})</Text>
              <Text style={styles.patientItemSub}>السن: {item.age || 'غير محدد'} | الهاتف: {item.phone || 'لا يوجد'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* TAB 3: PRESCRIPTION & CLINICAL EXAMINATION */}
      {activeTab === 'prescription' && (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>👤 البيانات الأساسية (Personal Hx)</Text>
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
              <View style={{ flex: 1 }}><Text style={styles.label}>الوظيفة</Text><TextInput style={styles.input} placeholder="الوظيفة" placeholderTextColor="#64748B" value={occupation} onChangeText={setOccupation} /></View>
            </View>
            <Text style={styles.label}>الأمراض المزمنة</Text>
            <TextInput style={styles.input} placeholder="الأمراض المزمنة..." placeholderTextColor="#64748B" value={chronicDiseases} onChangeText={setChronicDiseases} />
          </View>

          {/* C/o */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🩺 الشكوى الرئيسية (Chief Complaint C/o)</Text>
            <View style={styles.chipsContainer}>
              {['Generalized', 'Acute', 'Chronic', 'Progressive', 'Mechanical', 'Inflammatory', 'Arthralgia', 'Arthritis'].map(item => (
                <TouchableOpacity key={item} style={[styles.selectChip, coState[item.toLowerCase()] && styles.selectChipActive]} onPress={() => setCoState(p => ({ ...p, [item.toLowerCase()]: !p[item.toLowerCase()] }))}>
                  <Text style={[styles.selectChipText, coState[item.toLowerCase()] && styles.selectChipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 🦴 خريطة الهيكل العظمي التفاعلية (البصرية الفعلية) */}
          {isRheumaSpecialty && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>🦴 خريطة مفاصل الجسم التفاعلية (اضغط على المفصل لتحديد مكان الألم/الالتهاب)</Text>
              <Text style={styles.legendTitle}>🔴 نقرة أولى = ملتهب ومتورم (Arthritis) | 🔵 نقرة ثانية = ألم فقط (Arthralgia) | ⚪ نقرة ثالثة = إلغاء</Text>

              <View style={styles.visualSkeletonBox}>
                <Text style={styles.skeletonGenderLabel}>هيكل المريض ({gender}): اضغط على أي نقطة أدناه لتمييزها:</Text>
                
                {/* شبكة النقاط التفاعلية التوجيهية فوق شكل الهيكل */}
                <View style={styles.skeletonInteractiveContainer}>
                  {SKELETON_JOINTS.map(joint => {
                    const status = skeletonJointStates[joint.id];
                    return (
                      <TouchableOpacity
                        key={joint.id}
                        style={[
                          styles.skeletonMarkerBtn,
                          { top: joint.top, left: joint.left },
                          status === 'red' && styles.markerRed,
                          status === 'blue' && styles.markerBlue
                        ]}
                        onPress={() => handleSkeletonPointClick(joint.id)}
                      >
                        <Text style={styles.markerText}>{status === 'red' ? '🔴' : status === 'blue' ? '🔵' : '⚪'}</Text>
                        <Text style={styles.markerLabel}>{joint.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
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

          {/* الأعراض والتحاليل */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📸 تحاليل وأشعة ومرفقات المريض</Text>
            <Text style={styles.label}>1. سرعة الترسيب والبروتين الالتهابي (ESR / CRP):</Text>
            <View style={styles.chipsContainer}>
              {RHEUMA_OPTIONS.esrCrp.map(opt => (
                <TouchableOpacity key={opt} style={[styles.selectChip, rheumaEsrCrp === opt && styles.selectChipActive]} onPress={() => setRheumaEsrCrp(opt)}>
                  <Text style={[styles.selectChipText, rheumaEsrCrp === opt && styles.selectChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>2. Rheumatoid Factor (RF):</Text>
            <View style={styles.chipsContainer}>
              {RHEUMA_OPTIONS.rf.map(opt => (
                <TouchableOpacity key={opt} style={[styles.selectChip, rheumaRF === opt && styles.selectChipActive]} onPress={() => setRheumaRF(opt)}>
                  <Text style={[styles.selectChipText, rheumaRF === opt && styles.selectChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>3. Anti-CCP:</Text>
            <View style={styles.chipsContainer}>
              {RHEUMA_OPTIONS.antiCCP.map(opt => (
                <TouchableOpacity key={opt} style={[styles.selectChip, rheumaAntiCCP === opt && styles.selectChipActive]} onPress={() => setRheumaAntiCCP(opt)}>
                  <Text style={[styles.selectChipText, rheumaAntiCCP === opt && styles.selectChipTextActive]}>{opt}</Text>
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
                    <TouchableOpacity onPress={() => handleDeleteSavedScanFromRecord(sc.recordId, sc.url)}><Text style={{ color: '#EF4444', fontSize: 10, marginTop: 4 }}>حذف</Text></TouchableOpacity>
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
                <View style={styles.medHeader}><Text style={styles.medName}>💊 {med.name} - {med.dose}</Text><TouchableOpacity onPress={() => handleRemoveMed(idx)}><Text style={{ color: '#EF4444' }}>إزالة</Text></TouchableOpacity></View>
                <Text style={styles.medDetail}>{med.reason}</Text>
              </View>
            ))}

            <View style={styles.addMedBox}>
              <Text style={styles.label}>إضافة دواء يدوي:</Text>
              <TextInput style={styles.input} placeholder="اسم الدواء..." placeholderTextColor="#64748B" value={newMedName} onChangeText={setNewMedName} />
              <TextInput style={styles.input} placeholder="الجرعة..." placeholderTextColor="#64748B" value={newMedDose} onChangeText={setNewMedDose} />
              <TouchableOpacity style={styles.addMedBtn} onPress={handleCheckAndAddManualMed}><Text style={styles.addMedBtnText}>➕ إضافة للروشتة</Text></TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveAndPrint} disabled={loading}>
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
  title: { fontSize: 22, fontWeight: '900', color: '#00F2FE', textAlign: 'center' },
  subtitle: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 4 },
  topUserRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', width: '100%', marginBottom: 8 },
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
  
  /* خريطة الهيكل التفاعلية البصرية */
  visualSkeletonBox: { backgroundColor: '#060911', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#0284C7', alignItems: 'center', minHeight: 280, position: 'relative' },
  skeletonGenderLabel: { color: '#94A3B8', fontSize: 11, marginBottom: 10, textAlign: 'center' },
  legendTitle: { color: '#CBD5E1', fontSize: 10, textAlign: 'right', marginBottom: 8 },
  skeletonInteractiveContainer: { width: '100%', height: 240, position: 'relative', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 8, borderWidth: 1, borderColor: '#1E293B' },
  skeletonMarkerBtn: { position: 'absolute', transform: [{ translateX: -15 }, { translateY: -15 }], backgroundColor: '#1E293B', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: '#475569', alignItems: 'center', zIndex: 10 },
  markerRed: { backgroundColor: 'rgba(239, 68, 68, 0.4)', borderColor: '#EF4444' },
  markerBlue: { backgroundColor: 'rgba(59, 130, 246, 0.4)', borderColor: '#3B82F6' },
  markerText: { fontSize: 10 },
  markerLabel: { fontSize: 9, color: '#FFF', marginTop: 1, fontWeight: 'bold' },

  scansGridContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  scanGridCard: { backgroundColor: '#060911', padding: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  aiButton: { backgroundColor: '#0284C7', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  aiButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  medCard: { backgroundColor: '#060911', padding: 10, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#1E293B' },
  medHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
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
  authToggleBtn: { marginTop: 12, alignItems: 'center' },
  authToggleBtnText: { color: '#38BDF8', fontSize: 11 },
  paywallCard: { backgroundColor: '#0F172A', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#EF4444', alignItems: 'center' },
  paywallIcon: { fontSize: 30, marginBottom: 8 },
  paywallTitle: { fontSize: 16, fontWeight: 'bold', color: '#EF4444', marginBottom: 6 },
  paywallReason: { fontSize: 11, color: '#FCA5A5', textAlign: 'center', marginBottom: 15 },
  whatsappBtn: { backgroundColor: '#16A34A', padding: 12, borderRadius: 8, width: '100%', alignItems: 'center' },
  whatsappBtnText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  copyLinkBtn: { backgroundColor: '#0284C7', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  copyLinkBtnText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  saveProfileBtn: { backgroundColor: '#10B981', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  saveProfileBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  lightboxCloseBtn: { position: 'absolute', top: 20, right: 20, backgroundColor: '#EF4444', padding: 8, borderRadius: 6 }
});
