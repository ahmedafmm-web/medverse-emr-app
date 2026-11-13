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

// --- خريطة مفاصل الهيكل العظمي الرسمية معايرة بدقة 100% على أبعاد صورة skeleton.png ---
// تم توحيد اتجاهات المنظر الأمامي مع المنظر الخلفي (يمين الصورة = الأيمن، يسار الصورة = الأيسر)
const SKELETON_JOINTS = [
  // --- الهيكل الأمامي (Anterior - النصف الأيسر من الصورة) ---
  { id: 'Ant_TMJ', name: 'المفصل الفكي (أمامي)', x: 26.5, y: 8.5 },
  { id: 'Ant_Neck', name: 'فقرات الرقبة (أمامي)', x: 26.5, y: 15.5 },
  { id: 'Ant_L_Shoulder', name: 'الكتف الأيسر (أمامي)', x: 15.5, y: 21.5 },
  { id: 'Ant_R_Shoulder', name: 'الكتف الأيمن (أمامي)', x: 37.5, y: 21.5 },
  { id: 'Ant_L_Elbow', name: 'الكوع الأيسر (أمامي)', x: 12.0, y: 36.0 },
  { id: 'Ant_R_Elbow', name: 'الكوع الأيمن (أمامي)', x: 40.5, y: 36.0 },
  { id: 'Ant_L_Wrist', name: 'الرسغ الأيسر (أمامي)', x: 7.5, y: 49.5, subGroup: 'L_Hand' },
  { id: 'Ant_R_Wrist', name: 'الرسغ الأيمن (أمامي)', x: 44.5, y: 49.5, subGroup: 'R_Hand' },
  { id: 'Ant_L_MCP', name: 'اليد اليسرى (Hand)', x: 5.0, y: 55.5, subGroup: 'L_Hand' },
  { id: 'Ant_R_MCP', name: 'اليد اليمنى (Hand)', x: 46.5, y: 55.5, subGroup: 'R_Hand' },
  { id: 'Ant_Pelvis', name: 'الحوض (Pelvis)', x: 26.5, y: 47.0 },
  { id: 'Ant_L_Hip', name: 'مفصل الفخذ الأيسر', x: 19.5, y: 51.5 },
  { id: 'Ant_R_Hip', name: 'مفصل الفخذ الأيمن', x: 33.5, y: 51.5 },
  { id: 'Ant_L_Knee', name: 'الركبة اليسرى (أمامي)', x: 21.0, y: 72.0 },
  { id: 'Ant_R_Knee', name: 'الركبة اليمنى (أمامي)', x: 32.0, y: 72.0 },
  { id: 'Ant_L_Ankle', name: 'الكاحل الأيسر (أمامي)', x: 22.0, y: 90.5, subGroup: 'L_Foot' },
  { id: 'Ant_R_Ankle', name: 'الكاحل الأيمن (أمامي)', x: 31.0, y: 90.5, subGroup: 'R_Foot' },
  { id: 'Ant_L_MTP', name: 'القدم اليسرى (Foot)', x: 19.0, y: 95.5, subGroup: 'L_Foot' },
  { id: 'Ant_R_MTP', name: 'القدم اليمنى (Foot)', x: 34.0, y: 95.5, subGroup: 'R_Foot' },

  // --- الهيكل الخلفي (Posterior - النصف الأيمن من الصورة) ---
  { id: 'Post_Cervical', name: 'الفقرات العنقية (خلفي)', x: 74.5, y: 15.0 },
  { id: 'Post_Thoracic', name: 'العمود الفقري الظهري', x: 74.5, y: 27.5 },
  { id: 'Post_Lumbar', name: 'الفقرات القطنية (LBP)', x: 74.5, y: 39.5 },
  { id: 'Post_SIJ', name: 'المفاصل العجزية الحرقفية (SIJ)', x: 74.5, y: 47.0 },
  { id: 'Post_L_Shoulder', name: 'الكتف الأيسر (خلفي)', x: 63.5, y: 21.5 },
  { id: 'Post_R_Shoulder', name: 'الكتف الأيمن (خلفي)', x: 85.5, y: 21.5 },
  { id: 'Post_L_Elbow', name: 'الكوع الأيسر (خلفي)', x: 60.0, y: 36.0 },
  { id: 'Post_R_Elbow', name: 'الكوع الأيمن (خلفي)', x: 89.0, y: 36.0 },
  { id: 'Post_L_Knee', name: 'الركبة اليسرى (خلفي)', x: 69.0, y: 72.0 },
  { id: 'Post_R_Knee', name: 'الركبة اليمنى (خلفي)', x: 80.0, y: 72.0 },
  { id: 'Post_L_Ankle', name: 'الكاحل الأيسر (خلفي)', x: 69.5, y: 90.5 },
  { id: 'Post_R_Ankle', name: 'الكاحل الأيمن (خلفي)', x: 79.5, y: 90.5 }
];

// --- شريط التخصيص السريع للمفاصل الدقيقة لليد والقدم ---
const SUB_JOINTS_GROUPS = {
  R_Hand: {
    title: 'تخصيص مفاصل اليد اليمنى (Right Hand):',
    items: [
      { id: 'Sub_R_Wrist', label: 'Right Wrist', fullName: 'الرسغ الأيمن (Right Wrist)' },
      { id: 'Sub_R_MCPs', label: 'Right MCPs', fullName: 'مفاصل مشط اليد اليمنى (Right MCPs)' },
      { id: 'Sub_R_PIPs', label: 'Right PIPs', fullName: 'سلاميات اليد اليمنى الوسطى (Right PIPs)' },
      { id: 'Sub_R_DIPs', label: 'Right DIPs', fullName: 'سلاميات اليد اليمنى الطرفية (Right DIPs)' }
    ]
  },
  L_Hand: {
    title: 'تخصيص مفاصل اليد اليسرى (Left Hand):',
    items: [
      { id: 'Sub_L_Wrist', label: 'Left Wrist', fullName: 'الرسغ الأيسر (Left Wrist)' },
      { id: 'Sub_L_MCPs', label: 'Left MCPs', fullName: 'مفاصل مشط اليد اليسرى (Left MCPs)' },
      { id: 'Sub_L_PIPs', label: 'Left PIPs', fullName: 'سلاميات اليد اليسرى الوسطى (Left PIPs)' },
      { id: 'Sub_L_DIPs', label: 'Left DIPs', fullName: 'سلاميات اليد اليسرى الطرفية (Left DIPs)' }
    ]
  },
  R_Foot: {
    title: 'تخصيص مفاصل القدم اليمنى (Right Foot):',
    items: [
      { id: 'Sub_R_Ankle', label: 'Right Ankle', fullName: 'الكاحل الأيمن (Right Ankle)' },
      { id: 'Sub_R_Midfoot', label: 'Right Midfoot', fullName: 'مشط القدم الأيمن (Right Midfoot)' },
      { id: 'Sub_R_MTPs', label: 'Right MTPs', fullName: 'مفاصل أصابع القدم اليمنى (Right MTPs)' },
      { id: 'Sub_R_Toes', label: 'Right Toes (PIPs/DIPs)', fullName: 'سلاميات أصابع القدم اليمنى (Right Toes)' }
    ]
  },
  L_Foot: {
    title: 'تخصيص مفاصل القدم اليسرى (Left Foot):',
    items: [
      { id: 'Sub_L_Ankle', label: 'Left Ankle', fullName: 'الكاحل الأيسر (Left Ankle)' },
      { id: 'Sub_L_Midfoot', label: 'Left Midfoot', fullName: 'مشط القدم الأيسر (Left Midfoot)' },
      { id: 'Sub_L_MTPs', label: 'Left MTPs', fullName: 'مفاصل أصابع القدم اليسرى (Left MTPs)' },
      { id: 'Sub_L_Toes', label: 'Left Toes (PIPs/DIPs)', fullName: 'سلاميات أصابع القدم اليسرى (Left Toes)' }
    ]
  }
};

const ALL_SUB_JOINTS_FLAT = Object.values(SUB_JOINTS_GROUPS).flatMap(g => g.items);

const getJointDisplayName = (id) => {
  const mainJoint = SKELETON_JOINTS.find(j => j.id === id);
  if (mainJoint) return mainJoint.name;
  const subJoint = ALL_SUB_JOINTS_FLAT.find(s => s.id === id);
  if (subJoint) return subJoint.fullName;
  return id;
};

// --- خيارات الفحص السريع وقوائم الشكاوى التخصصية ---
const RHEUMA_OPTIONS = {
  stiffnessType: ["تيبس إيد", "تيبس ضهر"],
  stiffnessDuration: ["دقائق", "نصف ساعة أو أكثر"],
  diseaseNature: ["Acute (حاد)", "Chronic (مزمن)", "Progressive (متزايد)", "Mechanical (ميكانيكي)", "Inflammatory (التهابي)", "Arthralgia (ألم فقط)", "Arthritis (التهاب متورم)"],
  provisionalDiagnoses: [
    "Still in diagnosis (تحت التشخيص)",
    "Query Rheumatoid Arthritis (RA)",
    "Active RA (روماتويد نشط)",
    "Query SLE (ذئبة حمراء)",
    "Query Scleroderma (تصلب الجلد)",
    "Query Spondyloarthritis / AS",
    "Query Psoriatic Arthritis (PsA)",
    "Query Vasculitis (التهاب أوعية)",
    "Query Sjögren's Syndrome",
    "Query Polymyositis / Dermatomyositis",
    "Query Gout / Crystal Arthritis",
    "Query Fibromyalgia",
    "Query Osteoarthritis (OA)"
  ],
  systemicChecklist: [
    { id: 'morning_swelling', label: 'تورم وتخشيب صباحي باليدين (صعوبة خلع الخاتم)' },
    { id: 'hair_loss', label: 'تساقط شعر نشط (خصلات)' },
    { id: 'malar_rash', label: 'طفح جلدي في الوجه (Malar Rash / شمس)' },
    { id: 'general_rash', label: 'طفح جلدي عام في الجسم' },
    { id: 'oral_ulcers', label: 'قُرح فموية متكررة (Oral Ulcers)' },
    { id: 'dysphagia', label: 'صعوبة في البلع' },
    { id: 'heartburn', label: 'حرقة نفس واكتام / ارتجاع مريء' },
    { id: 'recurrent_diarrhea', label: 'إسهال متكرر' },
    { id: 'bloody_diarrhea', label: 'إسهال مصحوب بدم' },
    { id: 'raynauds', label: 'زرقة وتغير لون الأطراف (رينود عند البرد)' },
    { id: 'dysuria', label: 'حرقان بول متكرر' },
    { id: 'eye_redness', label: 'احمرار شديد أو ألم متكرر في العين' },
    { id: 'fever', label: 'حمى وسخونية متكررة' },
    { id: 'weight_loss', label: 'نزول ملحوظ في الوزن' },
    { id: 'appetite_loss', label: 'فقدان الشهية' },
    { id: 'lymph_nodes', label: 'كلاكيع / تضخم غدد لمفاوية (تحت الإبط / الذقن / الصدر)' }
  ],
  familyHistoryChecklist: [
    { id: 'immuno_chemo', label: 'أحد أفراد العائلة يتناول علاج مناعي أو كيماوي' },
    { id: 'fever_hospital', label: 'حجز سابق لأحد الأقارب بمستشفى الحميات' },
    { id: 'chronic_autoimmune', label: 'تاريخ عائلي لأمراض مناعية مزمنة' },
    { id: 'consanguinity', label: 'صلة قرابة بين الوالدين' }
  ],
  clinicalTests: [
    { id: 'mcps_squeeze', label: 'Hands MCPs Squeeze Test' },
    { id: 'mtps_squeeze', label: 'Feet MTPs Squeeze Test' },
    { id: 'slr', label: 'Straight Leg Raise (SLR)' },
    { id: 'crossed_slr', label: 'Crossed SLR Test' },
    { id: 'femoral_stretch', label: 'Femoral Stretch Test' },
    { id: 'sij_faber', label: 'SIJ FABER Test' }
  ],
  antiCCP: ["غير متوفر", "سلبي (Negative)", "إيجابي (+) < 3x", "إيجابي مرتفع (+++) > 3x"],
  rf: ["غير متوفر", "سلبي (Negative)", "إيجابي ضعيف (+)", "إيجابي مرتفع (+++)"],
  ana: ["غير متوفر", "سلبي (Negative)", "إيجابي Homogeneous", "إيجابي Speckled", "إيجابي Nucleolar"],
  antiDsDNA: ["غير متوفر", "سلبي (Negative)", "إيجابي مرتفع (Positive)"],
  connectiveTissue: ["غير متوفر", "Anti-Scl-70", "Anti-Centromere", "U1-RNP", "Anti-Ro / Anti-La (SS-A / SS-B)"],
  antiPhospholipid: ["غير متوفر", "سلبي", "إيجابي (تاريخ جلطات / إجهاض متكرر)"],
  esrCrp: ["طبيعي (Normal)", "مرتفع بدرجة متوسطة (Moderate)", "مرتفع جداً (High Active Flare)"],
  organSafety: ["طبيعي وآمن للعلاج", "ارتفاع طفيف في إنزيمات الكبد", "قصور كلوي / كبدي"],
  tbScreening: ["سلبي وجاهز للعلاج البيولوجي", "إيجابي / غير مكتمل", "لم يتم الفحص بعد"]
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
  const registeredWords = cleanRegistered
    .split(/\s+/)
    .filter(word => word.length > 2 && !['استشاري', 'أخصائي', 'دكتور', 'طبيب', 'مركز', 'عيادة', 'الأمراض', 'وجراحة', 'جراحة'].includes(word));
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
  const [clinicDoctorName, setClinicDoctorName] = useState('د. حسام المنفلوطي');
  const [clinicName, setClinicName] = useState('عياده المنفلوطي');
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

  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('ذكر');
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [familyHistoryText, setFamilyHistoryText] = useState('');
  const [selectedPatientCode, setSelectedPatientCode] = useState('');
  const [currentPatientId, setCurrentPatientId] = useState(null);

  // --- حالات التحديث الجديد للروماتيزم والمناعة ---
  const [selectedJointStates, setSelectedJointStates] = useState({}); // { JointID: 'inflamed' | 'painful' }
  const [jointSelectMode, setJointSelectMode] = useState('inflamed'); // 'inflamed' (أحمر) أو 'painful' (أزرق)
  const [activeSubJointGroup, setActiveSubJointGroup] = useState(null); // 'R_Hand' | 'L_Hand' | 'R_Foot' | 'L_Foot' | null
  const [stiffnessType, setStiffnessType] = useState('تيبس إيد');
  const [stiffnessDuration, setStiffnessDuration] = useState('نصف ساعة أو أكثر');
  const [selectedDiseaseNature, setSelectedDiseaseNature] = useState(['Inflammatory (التهابي)', 'Arthritis (التهاب متورم)']);
  const [selectedSystemicSigns, setSelectedSystemicSigns] = useState([]);
  const [selectedFamilySigns, setSelectedFamilySigns] = useState([]);
  const [selectedClinicalTests, setSelectedClinicalTests] = useState([]);

  const [rheumaAntiCCP, setRheumaAntiCCP] = useState('إيجابي مرتفع (+++) > 3x');
  const [rheumaRF, setRheumaRF] = useState('إيجابي مرتفع (+++)');
  const [rheumaANA, setRheumaANA] = useState('غير متوفر');
  const [rheumaAntiDsDNA, setRheumaAntiDsDNA] = useState('غير متوفر');
  const [rheumaConnective, setRheumaConnective] = useState('غير متوفر');
  const [rheumaAPL, setRheumaAPL] = useState('غير متوفر');
  const [rheumaEsrCrp, setRheumaEsrCrp] = useState('مرتفع جداً (High Active Flare)');
  const [rheumaOrganSafety, setRheumaOrganSafety] = useState('طبيعي وآمن للعلاج');
  const [rheumaTbScreening, setRheumaTbScreening] = useState('سلبي وجاهز للعلاج البيولوجي');
  const [isQueryDiagnosis, setIsQueryDiagnosis] = useState(false);
  const [selectedProvisionalChips, setSelectedProvisionalChips] = useState([]);
  const [provisionalDiagnosisText, setProvisionalDiagnosisText] = useState('');

  // حالة رفع صورة تحاليل/أشعة للذكاء الاصطناعي للقراءة الفورية
  const [aiScanFile, setAiScanFile] = useState(null);
  const [aiScanPreviewUrl, setAiScanPreviewUrl] = useState('');
  const [aiScanBase64, setAiScanBase64] = useState('');

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

  const isRheumaSpecialty = specialty.includes("الروماتيزم") || specialty.includes("الروماتويد") || specialty.includes("المناعية");

  const toggleMultiSelect = (item, currentList, setter) => {
    if (currentList.includes(item)) setter(currentList.filter(i => i !== item));
    else setter([...currentList, item]);
  };

  const getCombinedProvisionalText = () => {
    const parts = [...selectedProvisionalChips];
    if (provisionalDiagnosisText.trim()) {
      parts.push(provisionalDiagnosisText.trim());
    }
    return parts.join(' | ');
  };

  const handleJointClick = (jointId) => {
    const jointObj = SKELETON_JOINTS.find(j => j.id === jointId);
    if (jointObj && jointObj.subGroup) {
      setActiveSubJointGroup(jointObj.subGroup);
    }
    setSelectedJointStates(prev => {
      const current = prev[jointId];
      if (current === jointSelectMode) {
        const copy = { ...prev };
        delete copy[jointId];
        return copy;
      }
      return { ...prev, [jointId]: jointSelectMode };
    });
  };

  const handleSubJointToggle = (subJointId) => {
    setSelectedJointStates(prev => {
      const current = prev[subJointId];
      if (current === jointSelectMode) {
        const copy = { ...prev };
        delete copy[subJointId];
        return copy;
      }
      return { ...prev, [subJointId]: jointSelectMode };
    });
  };

  const handleRemoveSelectedJoint = (jointId) => {
    setSelectedJointStates(prev => {
      const copy = { ...prev };
      delete copy[jointId];
      return copy;
    });
  };

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
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchDoctorProfile(session.user);
        checkSubscription(session.user);
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

  const handleSelectAiScanImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAiScanFile(file);
    const url = URL.createObjectURL(file);
    setAiScanPreviewUrl(url);

    const reader = new FileReader();
    reader.onloadend = () => {
      setAiScanBase64(reader.result);
    };
    reader.readAsDataURL(file);
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

  const handleRemoveSingleScan = (id) => {
    setSelectedScanFiles(prev => prev.filter(item => item.id !== id));
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
                title: sc.title || 'أشعة ومستند طبّي', 
                recordId: r.id, 
                date: r.created_at || r.visit_date 
              });
            }
          });
        } else if (df.scanUrl) {
          allScans.push({ 
            url: String(df.scanUrl), 
            title: df.scanTitle || 'أشعة طبية', 
            recordId: r.id, 
            date: r.created_at || r.visit_date 
          });
        }
      });

      setPatientScansGrid(allScans);
    } catch (e) {
      console.error('Fetch Scans Error:', e);
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
      const currentUserId = session?.user?.id;
      let patientCode = selectedPatientCode;
      let patientId = currentPatientId;

      let clinicId = null;
      let cQuery = supabase.from('clinics').select('id');
      if (userEmail) cQuery = cQuery.ilike('email', userEmail);
      else if (currentUserId) cQuery = cQuery.eq('user_id', currentUserId);

      const { data: existingClinic } = await cQuery.limit(1).maybeSingle();
      if (existingClinic) clinicId = existingClinic.id;

      const uploadedList = [];
      const total = selectedScanFiles.length;

      for (let i = 0; i < total; i++) {
        const item = selectedScanFiles[i];
        const compressed = await compressImage(item.file, 2400, 0.92);
        const uniqueId = Math.random().toString(36).substring(2, 9);
        const filePath = `patient_scans/${patientCode}/${Date.now()}_${uniqueId}_${i}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from('clinic-assets')
          .upload(filePath, compressed, { upsert: true });

        let publicUrl = '';
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('clinic-assets').getPublicUrl(filePath);
          publicUrl = urlData?.publicUrl || (urlData?.data ? urlData.data.publicUrl : null) || `https://emynlqikbdwogijqfbfw.supabase.co/storage/v1/object/public/clinic-assets/${filePath}`;
        } else {
          publicUrl = item.previewUrl;
        }

        uploadedList.push({
          id: Date.now() + '_' + i,
          title: item.title || scanGroupTitle || 'أشعة وفحص طبي بدقة عالية',
          url: publicUrl,
          created_at: new Date().toISOString()
        });

        setScanUploadProgress(Math.round(((i + 1) / total) * 100));
      }

      const { error: insertErr } = await supabase.from('medical_records').insert([{
        patient_id: patientId,
        clinic_id: clinicId,
        doctor_email: userEmail,
        visit_date: new Date().toISOString().split('T')[0],
        diagnosis: scanGroupTitle ? `أشعة وفحوصات: ${scanGroupTitle}` : 'أشعة ومستندات مرفقة',
        qr_verification_code: 'VERIFY-' + patientCode,
        dynamic_fields: { scans_list: uploadedList }
      }]);

      if (insertErr) throw insertErr;

      showAlert('تم الحفظ بنجاح ✅', `تم حفظ (${uploadedList.length}) أشعة عالية الدقة في ملف المريض [${patientCode}].`);
      setSelectedScanFiles([]);
      setScanGroupTitle('');
      await fetchPatientScansByPatientId(patientId);

    } catch (err) {
      showAlert('خطأ', 'فشل حفظ الأشعات: ' + err.message);
    } finally {
      setUploadingScans(false);
    }
  };

  const handleDeleteSavedScanFromRecord = async (recordId, scanUrl) => {
    if (Platform.OS === 'web') {
      if (!window.confirm("هل أنت متأكد من حذف صورة الأشعة هذه نهائياً؟")) return;
    }
    try {
      const record = patientHistory.find(r => r.id === recordId);
      if (!record || !record.dynamic_fields) return;

      const df = typeof record.dynamic_fields === 'string' ? JSON.parse(record.dynamic_fields) : record.dynamic_fields;
      const updatedScans = (df.scans_list || []).filter(s => s.url !== scanUrl);
      
      await supabase
        .from('medical_records')
        .update({ dynamic_fields: { ...df, scans_list: updatedScans } })
        .eq('id', recordId);

      showAlert('تم الحذف', 'تم حذف الصورة من ملف المريض.');
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
      setLogoUploadProgress(50);
      const filePath = `logos/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('clinic-assets')
        .upload(filePath, compressedBlob, { upsert: true });

      setLogoUploadProgress(85);
      if (error) {
        const reader = new FileReader();
        reader.onload = () => {
          setClinicLogoUrl(reader.result);
          setLogoUploadProgress(100);
          setUploadingLogo(false);
        };
        reader.readAsDataURL(compressedBlob);
      } else {
        const { data: publicUrlData } = supabase.storage.from('clinic-assets').getPublicUrl(filePath);
        setClinicLogoUrl(publicUrlData.publicUrl);
        setLogoUploadProgress(100);
        setUploadingLogo(false);
      }
    } catch (err) {
      showAlert('خطأ في الرفع', err.message || 'تعذر رفع وتصغير الصورة');
      setUploadingLogo(false);
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
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (!signInErr) showAlert('تم إنشاء الحساب 🎉', 'تم إنشاء الحساب وتسجيل الدخول بنجاح!');
        else showAlert('تم إنشاء الحساب 🎉', 'تم إنشاء الحساب بنجاح!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
      }
    } catch (err) {
      showAlert('خطأ في الحساب', err.message || 'فشل عملية تسجيل الدخول.');
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
      const currentUserId = session?.user?.id;
      let query = supabase.from('clinics').select('id');
      if (userEmail) query = query.ilike('email', userEmail);
      else if (currentUserId) query = query.eq('user_id', currentUserId);

      const { data: clinic } = await query.limit(1).maybeSingle();
      const clinicIdentifier = clinic?.id || userEmail || currentUserId;
      const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined' 
        ? window.location.origin.split('?')[0] 
        : 'https://medverse-emr-suite.vercel.app';

      const portalUrl = `${baseUrl}?c=${encodeURIComponent(clinicIdentifier)}`;
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(portalUrl);
        showAlert('تم النسخ بنجاح! 📋', `رابط عيادتك المخصص للمرضى:\n${portalUrl}`);
      } else {
        showAlert('رابط عيادتك المخصص', portalUrl);
      }
    } catch (err) {
      showAlert('خطأ', 'تعذر نسخ الرابط.');
    }
  };

  const fetchDoctorProfile = async (user) => {
    try {
      const userEmail = user?.email?.toLowerCase();
      let query = supabase.from('clinics').select('*');
      if (userEmail) query = query.ilike('email', userEmail);
      else if (user?.id) query = query.eq('user_id', user.id);
      
      const { data: clinic, error } = await query.limit(1).maybeSingle();
      if (clinic && !error) {
        if (clinic.doctor_name) setClinicDoctorName(clinic.doctor_name);
        if (clinic.clinic_name) setClinicName(clinic.clinic_name);
        if (clinic.specialty) {
          setRegisteredSpecialty(clinic.specialty);
          const isMatched = isSpecialtyMatching(initialSpecialty, clinic.specialty);
          if (!isMatched) setShowMismatchModal(true);
          else setSpecialty(clinic.specialty);
          if (onUpdateSpecialty) onUpdateSpecialty(clinic.specialty);
        }
        if (clinic.logo_url) setClinicLogoUrl(clinic.logo_url);
        if (clinic.stamp_url) setDigitalStampUrl(clinic.stamp_url);
        if (clinic.phone) setClinicPhone(clinic.phone);
        if (clinic.address) setClinicAddress(clinic.address);
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const currentUserId = session?.user?.id;
      const userEmail = session?.user?.email?.toLowerCase();
      let query = supabase.from('clinics').select('id');
      if (userEmail) query = query.ilike('email', userEmail);
      else if (currentUserId) query = query.eq('user_id', currentUserId);

      const { data: existingClinic } = await query.limit(1).maybeSingle();
      const profilePayload = {
        doctor_name: clinicDoctorName,
        clinic_name: clinicName,
        specialty: specialty,
        logo_url: clinicLogoUrl,
        stamp_url: digitalStampUrl,
        phone: clinicPhone,
        address: clinicAddress,
        email: userEmail || null,
        user_id: currentUserId || null
      };

      if (existingClinic) await supabase.from('clinics').update(profilePayload).eq('id', existingClinic.id);
      else await supabase.from('clinics').insert([profilePayload]);

      setRegisteredSpecialty(specialty);
      setShowMismatchModal(false);
      if (onUpdateSpecialty) onUpdateSpecialty(specialty);
      showAlert('تم الحفظ', 'تم حفظ وتحديث التخصص بنجاح!');
    } catch (err) {
      showAlert('خطأ', 'فشل الحفظ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPatients = async () => {
    setLoadingPatientsList(true);
    try {
      const userEmail = session?.user?.email?.toLowerCase();
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .ilike('doctor_email', userEmail)
        .order('created_at', { ascending: false });

      if (!error && data) setAllDoctorPatients(data);
    } catch (e) { console.error(e); } 
    finally { setLoadingPatientsList(false); }
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
    const dummyName = 'أحمد علي حسين';
    setPatientName(dummyName);
    setPatientPhone('01012345678');
    setAge('54');
    setGender('ذكر');
    setChronicDiseases('روماتويد مفصلي، ارتفاع ضغط الدم');
    setFamilyHistoryText('تاريخ عائلي للأمراض المناعية والروماتيزم');
    setStiffnessType('تيبس إيد');
    setStiffnessDuration('نصف ساعة أو أكثر');
    setSelectedJointStates({
      'Ant_L_MCP': 'inflamed',
      'Ant_R_MCP': 'inflamed',
      'Ant_L_Wrist': 'inflamed',
      'Ant_R_Wrist': 'inflamed',
      'Sub_R_MCPs': 'inflamed',
      'Sub_L_MCPs': 'inflamed',
      'Ant_L_Knee': 'painful',
      'Ant_R_Knee': 'painful'
    });
    setSelectedSystemicSigns(['morning_swelling', 'hair_loss', 'oral_ulcers']);
    setSelectedFamilySigns(['chronic_autoimmune']);
    setSelectedClinicalTests(['mcps_squeeze']);
    setRheumaAntiCCP('إيجابي مرتفع (+++) > 3x');
    setRheumaRF('إيجابي مرتفع (+++)');
    setRheumaEsrCrp('مرتفع جداً (High Active Flare)');
    handleSearchPatientByName(dummyName);
  };

  const handleClinicalAnalysis = async () => {
    if (!patientName.trim()) {
      showAlert('تنبيه', 'يرجى إدخال اسم المريض أولاً.');
      return;
    }

    setAnalyzing(true);
    setAiReport(null);

    const inflamedJointsList = [];
    const painfulJointsList = [];
    Object.entries(selectedJointStates).forEach(([id, state]) => {
      const name = getJointDisplayName(id);
      if (state === 'inflamed') inflamedJointsList.push(name);
      else if (state === 'painful') painfulJointsList.push(name);
    });

    const systemicSignsNames = RHEUMA_OPTIONS.systemicChecklist
      .filter(item => selectedSystemicSigns.includes(item.id))
      .map(item => item.label);

    const familySignsNames = RHEUMA_OPTIONS.familyHistoryChecklist
      .filter(item => selectedFamilySigns.includes(item.id))
      .map(item => item.label);

    const clinicalTestsNames = RHEUMA_OPTIONS.clinicalTests
      .filter(item => selectedClinicalTests.includes(item.id))
      .map(item => item.label);

    const combinedProvisional = getCombinedProvisionalText();

    const queryNote = isQueryDiagnosis
      ? `NOTE: This is a PROVISIONAL / QUERY DIAGNOSIS (تشخيص مبدئي محتمل). Doctor's suspected provisional diagnosis: "${combinedProvisional || 'Unspecified'}". Evaluate this provisional suspicion against the clinical findings, suggest probable differential diagnoses, and recommend specific required laboratory tests/radiology to confirm.`
      : "";

    const systemPrompt = `You are an expert AI Clinical Rheumatologist & Immunologist.
Analyze the rheumatology patient case based on ACR/EULAR criteria.
${queryNote}

Respond ONLY with a valid JSON object without Markdown formatting:
{
  "diagnosis": "English Diagnosis - الشرح بالعربي",
  "warnings": ["تحذير إكلينيكي بالعربي عن الضغط، الكبد، التعارضات والتحاليل"],
  "medications": [
    {
      "name": "Exact Drug Name",
      "dose": "الجرعة والتوقيت بالعربي بدقة",
      "reason": "دواعي الاستعمال بالعربي"
    }
  ],
  "recommendedTests": ["التحاليل والأشعة المطلوبة للتأكيد بالعربي إن وجد"]
}`;

    const promptText = `
Specialty: ${specialty}
Patient: ${patientName} | Age: ${age || 'Unspecified'} | Gender: ${gender}
Chronic Diseases: ${chronicDiseases || 'None'}
Family History: ${familyHistoryText || 'None'} | Family Risk Signs: ${familySignsNames.join(', ') || 'None'}

-- History & Morning Stiffness --
- Morning Stiffness Type: ${stiffnessType || 'None'}
- Morning Stiffness Duration: ${stiffnessType ? stiffnessDuration : 'None'}
- Disease Nature: ${selectedDiseaseNature.join(', ')}
- Systemic & Extra-articular Signs: ${systemicSignsNames.join(', ') || 'None'}

-- Clinical Joint Map (O/E) --
- INFLAMMED/SWOLLEN JOINTS (Red): ${inflamedJointsList.join(', ') || 'None'}
- PAINFUL JOINTS ONLY (Blue): ${painfulJointsList.join(', ') || 'None'}

-- Physical & Clinical Tests --
- Physical Examination Findings: ${clinicalTestsNames.join(', ') || 'None'}

-- Serology & Lab Markers --
- ESR / CRP: ${rheumaEsrCrp}
- Anti-CCP: ${rheumaAntiCCP} | RF: ${rheumaRF}
- ANA: ${rheumaANA} | Anti-dsDNA: ${rheumaAntiDsDNA}
- Connective Tissue Markers (Anti-Scl-70/Centromere/Ro/La): ${rheumaConnective}
- Anti-Phospholipid: ${rheumaAPL}
- Organ Safety (LFTs/Kidney): ${rheumaOrganSafety}
- TB Screening: ${rheumaTbScreening}

${isQueryDiagnosis ? `Doctor's Provisional / Query Diagnosis: ${combinedProvisional || 'Suspected autoimmune/rheumatic condition'}` : ''}
Additional Doctor Notes & Symptoms: ${symptomsInput || 'None'} | ${doctorNotes || ''}`;

    try {
      let requestBody;
      if (aiScanBase64) {
        requestBody = {
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: promptText + "\n[Attached Lab/Scan Image for OCR Analysis]" },
                { type: "image_url", image_url: { url: aiScanBase64 } }
              ]
            }
          ],
          temperature: 0.2
        };
      } else {
        requestBody = {
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: promptText }
          ],
          temperature: 0.2
        };
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `خطأ الخادم (${response.status})`);
      }

      const data = await response.json();
      const rawContent = data?.choices?.[0]?.message?.content;
      if (!rawContent) throw new Error('استجابة فارغة من الذكاء الاصطناعي');

      const cleanJsonString = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedResult = JSON.parse(cleanJsonString);

      if (parsedResult.warnings) {
        parsedResult.warnings = parsedResult.warnings.map(w => sanitizeText(w));
      }

      setAiReport(parsedResult);
      if (parsedResult.diagnosis) {
        const queryPrefix = isQueryDiagnosis
          ? `[Query Diagnosis${combinedProvisional ? `: ${combinedProvisional}` : ''}]: `
          : '';
        setFinalDiagnosis(`${queryPrefix}${parsedResult.diagnosis}`);
      }
      if (parsedResult.medications && Array.isArray(parsedResult.medications)) {
        setPrescribedMeds(parsedResult.medications);
      }

    } catch (error) {
      console.error("Analysis Error:", error);
      showAlert('تنبيه الذكاء الاصطناعي', `تعذر التحليل التلقائي: ${error.message}\nيمكنك كتابة التشخيص والأدوية يدوياً.`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCheckAndAddManualMed = async () => {
    if (!newMedName.trim() || !newMedDose.trim()) {
      showAlert('تنبيه', 'أدخل اسم الدواء والجرعة على الأقل.');
      return;
    }

    setCheckingMed(true);
    setMedCheckError(null);
    setPendingMed(null);

    const systemPrompt = `You are a Clinical Pharmacologist for specialty: ${specialty}.
Check interaction hazards (e.g. Methotrexate/Azathioprine with Allopurinol/Clarithromycin).
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
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.1
        })
      });

      const data = await res.json();
      const rawContent = data?.choices?.[0]?.message?.content || '{}';
      const cleanJsonString = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonString);

      if (parsed.safe) {
        setPrescribedMeds(prev => [...prev, { name: newMedName, dose: newMedDose, reason: newMedReason || 'إضافة مباشرة من الطبيب' }]);
        setNewMedName('');
        setNewMedDose('');
        setNewMedReason('');
      } else {
        const conflictReason = sanitizeText(parsed.reason) || 'قد يتعارض هذا الدواء مع الحالة الحالية للمريض أو الأدوية المسجلة.';
        setMedCheckError(conflictReason);
        setPendingMed({
          name: newMedName,
          dose: newMedDose,
          reason: newMedReason || 'إضافة مباشرة على مسؤولية الطبيب'
        });
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

  const handleDismissConflict = () => {
    setMedCheckError(null);
    setPendingMed(null);
    setNewMedName('');
    setNewMedDose('');
    setNewMedReason('');
  };

  const handleForceAddMed = () => {
    if (pendingMed) {
      setPrescribedMeds(prev => [...prev, pendingMed]);
      handleDismissConflict();
    }
  };

  const handleRemoveMed = (index) => {
    setPrescribedMeds(prev => prev.filter((_, i) => i !== index));
  };

  const executeSaveAndPrint = async () => {
    setLoading(true);
    const generatedCode = selectedPatientCode || ('PAT-' + Math.floor(10000 + Math.random() * 90000));
    const combinedProvisional = getCombinedProvisionalText();

    try {
      let clinicId = null;
      const currentUserId = session?.user?.id;
      const userEmail = session?.user?.email?.toLowerCase();

      let cQuery = supabase.from('clinics').select('id');
      if (userEmail) cQuery = cQuery.ilike('email', userEmail);
      else if (currentUserId) cQuery = cQuery.eq('user_id', currentUserId);

      const { data: existingClinic } = await cQuery.limit(1).maybeSingle();
      if (existingClinic) clinicId = existingClinic.id;
      else {
        const { data: newClinic, error: cErr } = await supabase
          .from('clinics')
          .insert([{ 
            doctor_name: clinicDoctorName, 
            specialty: specialty, 
            clinic_name: clinicName,
            logo_url: clinicLogoUrl,
            stamp_url: digitalStampUrl,
            phone: clinicPhone,
            address: clinicAddress,
            email: userEmail || null,
            user_id: currentUserId || null
          }])
          .select('id')
          .single();

        if (cErr) throw new Error('خطأ في حفظ بيانات العيادة: ' + cErr.message);
        clinicId = newClinic?.id;
      }

      let patientRealId = currentPatientId;
      let patientRealCode = generatedCode;

      if (!patientRealId) {
        const { data: existingPatient } = await supabase
          .from('patients')
          .select('id, patient_code')
          .ilike('full_name', patientName.trim())
          .ilike('doctor_email', userEmail)
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
              clinic_id: clinicId,
              doctor_email: userEmail || null
            }])
            .select('id, patient_code')
            .single();

          if (pErr) throw new Error('خطأ في حفظ بيانات المريض: ' + pErr.message);
          patientRealId = newPatient?.id;
          patientRealCode = newPatient?.patient_code || generatedCode;
        }
      }

      setSelectedPatientCode(patientRealCode);
      setCurrentPatientId(patientRealId);

      if (patientRealId) {
        const { error: recErr } = await supabase
          .from('medical_records')
          .insert([{
            patient_id: patientRealId,
            clinic_id: clinicId,
            doctor_email: userEmail || null,
            visit_date: new Date().toISOString().split('T')[0],
            diagnosis: finalDiagnosis,
            prescriptions: prescribedMeds,
            qr_verification_code: 'VERIFY-' + patientRealCode,
            dynamic_fields: { 
              age, 
              gender, 
              chronicDiseases, 
              familyHistory: familyHistoryText, 
              symptoms: symptomsInput,
              rheumaDetails: isRheumaSpecialty ? {
                stiffnessType,
                stiffnessDuration,
                provisionalDiagnosis: isQueryDiagnosis ? combinedProvisional : null,
                jointStates: selectedJointStates,
                esrCrp: rheumaEsrCrp,
                antiCCP: rheumaAntiCCP,
                rf: rheumaRF,
                ana: rheumaANA,
                antiDsDNA: rheumaAntiDsDNA,
                connective: rheumaConnective,
                apl: rheumaAPL,
                organSafety: rheumaOrganSafety,
                tbScreening: rheumaTbScreening
              } : null
            }
          }]);

        if (recErr) throw new Error('خطأ في حفظ السجل الطبي: ' + recErr.message);
      }

      showAlert("نجاح الحفظ السحابي ✅", `تم حفظ التقرير والسجل الطبي بنجاح!\nكود المريض: [${patientRealCode}]`);

      await generatePrescriptionPDF(
        { name: patientName, phone: patientPhone, code: patientRealCode },
        finalDiagnosis,
        {
          'السن والنوع': `${age || 'غير محدد'} سنة (${gender})`,
          'الأمراض المزمنة': chronicDiseases || 'لا يوجد',
          'ملاحظات التشخيص': isQueryDiagnosis
            ? `تشخيص محتمل (${combinedProvisional || 'Query Diagnosis'}) - يحتاج متابعة`
            : 'فحص معتمد'
        },
        prescribedMeds,
        {
          doctorName: clinicDoctorName,
          clinicName: clinicName,
          specialty: specialty,
          logoUrl: clinicLogoUrl,
          stampUrl: digitalStampUrl,
          phone: clinicPhone,
          address: clinicAddress,
          isBWFriendly: true
        }
      );

      await fetchPatientScansByPatientId(patientRealId);

    } catch (error) {
      console.error('Detailed Save Error:', error);
      showAlert("خطأ في الحفظ السحابي ❌", `فشل حفظ التقرير في السحابة:\n${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndPrint = () => {
    if (!patientName.trim()) {
      showAlert('تنبيه هام', 'يرجى إدخال اسم المريض بالكامل أولاً قبل الاعتماد والطباعة.');
      return;
    }

    if (Platform.OS === 'web') {
      if (window.confirm("هل أنت متأكد من اعتماد هذا التقرير وحفظه في السحابة أولاً؟")) {
        executeSaveAndPrint();
      }
    } else {
      Alert.alert(
        "تأكيد اعتماد التقرير",
        "هل أنت متأكد من اعتماد هذا التقرير وحفظه في السحابة أولاً؟",
        [
          { text: "إلغاء", style: "cancel" },
          { text: "نعم، اعتمد واحفظ", onPress: () => executeSaveAndPrint() }
        ],
        { cancelable: true }
      );
    }
  };

  const isPatientSavedInDb = Boolean(currentPatientId || selectedPatientCode);

  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00F2FE" />
      </View>
    );
  }

  if (!session) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ justifyContent: 'center', minHeight: '80%' }}>
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>MedVerse Doctor Portal 🔒</Text>
          <Text style={styles.authSub}>{isSigningUp ? 'إنشاء حساب طبيب جديد' : 'تسجيل دخول الطبيب'}</Text>

          <Text style={styles.label}>البريد الإلكتروني (Gmail)</Text>
          <TextInput
            style={styles.input}
            placeholder="doctor@gmail.com"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>كلمة السر</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.authSubmitBtn} onPress={handleAuth} disabled={authSubmitting}>
            {authSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.authSubmitBtnText}>{isSigningUp ? 'إنشاء حساب جديد ✨' : 'تسجيل الدخول 🔐'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.authToggleBtn} onPress={() => setIsSigningUp(!isSigningUp)}>
            <Text style={styles.authToggleBtnText}>
              {isSigningUp ? 'لديك حساب بالفعل؟ سجل دخولك' : 'ليس لديك حساب؟ أنشئ حساب جديد الآن'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowPrivacyModal(true)} style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: '#38BDF8', fontSize: 12 }}>🛡️ سياسة الخصوصية وشروط الاستخدام</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showPrivacyModal} animationType="slide">
          <PrivacyPolicy onBack={() => setShowPrivacyModal(false)} />
        </Modal>
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

          <View style={styles.paywallInfoBox}>
            <Text style={styles.paywallInfoTitle}>طرق الدفع وتجديد الاشتراك:</Text>
            
            <View style={styles.paymentMethodRow}>
              <Text style={styles.paymentMethodText}>📱 المحفظة الإلكترونية (فودافون كاش / غيرها):</Text>
              <Text style={styles.paymentDetail}>01127834972</Text>
            </View>

            <View style={styles.paymentMethodRow}>
              <Text style={styles.paymentMethodText}>💸 الدفع عبر InstaPay:</Text>
              <TouchableOpacity style={styles.instaPayBtn} onPress={handleOpenInstaPay}>
                <Text style={styles.instaPayBtnText}>⚡ اضغط للدفع عبر InstaPay</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.paywallSubNote}>
            بعد تحويل رسوم الاشتراك الشهري أو السنوي، يرجى الضغط على الزر أدناه لإرسال صورة التحويل عبر الواتساب لتفعيل حسابك فوراً.
          </Text>

          <TouchableOpacity style={styles.whatsappBtn} onPress={handleOpenWhatsApp}>
            <Text style={styles.whatsappBtnText}>💬 التواصل مع الدعم عبر الواتساب لتفعيل الحساب</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSignOut} style={styles.paywallSignOutBtn}>
            <Text style={styles.signOutText}>تسجيل الخروج ✕</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Lightbox Ultra-Zoom Modal */}
      <Modal visible={!!viewingImageModal} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => { setViewingImageModal(null); setZoomScale(1); }}>
            <Text style={styles.lightboxCloseText}>إغلاق ✕</Text>
          </TouchableOpacity>
          <View style={styles.lightboxControls}>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomScale(z => Math.min(z + 0.8, 5))}>
              <Text style={styles.zoomBtnText}>🔍 تكبير عالي (+)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomScale(1)}>
              <Text style={styles.zoomBtnText}>🔄 إعادة (1x)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomScale(z => Math.max(z - 0.4, 0.5))}>
              <Text style={styles.zoomBtnText}>🔍 تصغير (-)</Text>
            </TouchableOpacity>
          </View>
          {viewingImageModal && (
            <ScrollView contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', flexGrow: 1 }} maximumZoomScale={5} minimumZoomScale={0.5}>
              <Image 
                source={{ uri: viewingImageModal.url }} 
                style={{ width: 340 * zoomScale, height: 340 * zoomScale, borderRadius: 8 }} 
                resizeMode="contain"
              />
              <Text style={styles.lightboxTitle}>{viewingImageModal.title}</Text>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal visible={showPrivacyModal} animationType="slide">
        <PrivacyPolicy onBack={() => setShowPrivacyModal(false)} />
      </Modal>

      {/* Specialty Mismatch Modal */}
      <Modal visible={showMismatchModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ تخصص العيادة المسجل مختلف</Text>
            <Text style={styles.modalSub}>
              أنت داخل على تخصص ({initialSpecialty}) لكن تخصصك المسجل في العيادة هو ({registeredSpecialty}). هل تريد الانتقال لتخصصك أم الاستمرار في هذا التخصص؟
            </Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity 
                style={styles.modalGoBtn} 
                onPress={() => {
                  setSpecialty(registeredSpecialty);
                  setShowMismatchModal(false);
                  if (onUpdateSpecialty) onUpdateSpecialty(registeredSpecialty);
                }}
              >
                <Text style={styles.modalGoBtnText}>الانتقال للتخصص المسجل بالبروفايل</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalStayBtn} 
                onPress={() => setShowMismatchModal(false)}
              >
                <Text style={styles.modalStayBtnText}>الاستمرار بالتخصص الحالي</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Subscription Warning Banner */}
      {subscriptionAccess.showAlert && (
        <View style={styles.subWarningBanner}>
          <Text style={styles.subWarningIcon}>⏳</Text>
          <Text style={styles.subWarningText}>
            تنبيه الاشتراك: {dynamicTimeLeftText || subscriptionAccess.message}
          </Text>
          <TouchableOpacity style={styles.renewQuickBtn} onPress={handleOpenWhatsApp}>
            <Text style={styles.renewQuickBtnText}>تجديد ⚡</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header With Neon Glow & DEVEXT Branding */}
      <View style={styles.header}>
        <View style={styles.topUserRow}>
          <Text style={styles.userEmailText}>⚡ {clinicDoctorName} ({session?.user?.email})</Text>
          {onSwitchPortal && (
            <TouchableOpacity onPress={onSwitchPortal} style={styles.switchPortalBtn}>
              <Text style={styles.switchPortalBtnText}>🔄 تغيير البوابة</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>خروج ✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>MedVerse Smart EMR Suite</Text>

        <View style={styles.brandRow}>
          <Text style={styles.brandTag}>POWERED BY</Text>
          <Text style={styles.brandSubtitle}>DEVEXT</Text>
        </View>

        <Text style={styles.subtitle}>منظومة إدارة العيادات والأشعة الذكية ({specialty})</Text>
      </View>

      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={[styles.navBtn, activeTab === 'prescription' && styles.navBtnActive]} onPress={() => handleTabChange('prescription')}>
          <Text style={[styles.navBtnText, activeTab === 'prescription' && styles.navBtnTextActive]}>🩺 الكشف والأشعة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, activeTab === 'patients' && styles.navBtnActive]} onPress={() => { handleTabChange('patients'); fetchAllPatients(); }}>
          <Text style={[styles.navBtnText, activeTab === 'patients' && styles.navBtnTextActive]}>📂 قائمة المرضى</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, activeTab === 'profile' && styles.navBtnActive]} onPress={() => handleTabChange('profile')}>
          <Text style={[styles.navBtnText, activeTab === 'profile' && styles.navBtnTextActive]}>⚙️ بروفايل العيادة</Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: PROFILE */}
      {activeTab === 'profile' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>⚙️ بيانات الطبيب، العيادة، والختم الإلكتروني</Text>

          <View style={styles.linkCardBox}>
            <Text style={styles.linkBoxTitle}>🔗 رابط بوابة المرضى الخاصة بك</Text>
            <Text style={styles.linkBoxSub}>مربوط مع بريدك الإلكتروني الفريد: {session.user.email}</Text>
            <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyPortalLink}>
              <Text style={styles.copyLinkBtnText}>📋 نسخ رابط العيادة المخصص للمرضى</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>اسم الطبيب بالكامل</Text>
          <TextInput style={styles.input} value={clinicDoctorName} onChangeText={setClinicDoctorName} />

          <Text style={styles.label}>اسم العيادة / المركز الطبي</Text>
          <TextInput style={styles.input} value={clinicName} onChangeText={setClinicName} />

          <Text style={styles.label}>التخصص والدرجة العلمية (اختيار مباشر):</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {SPECIALITIES_LIST.map((spec, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.specChip, specialty === spec && styles.specChipActive]}
                onPress={() => setSpecialty(spec)}
              >
                <Text style={[styles.specChipText, specialty === spec && styles.specChipTextActive]}>{spec}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput style={styles.input} value={specialty} onChangeText={setSpecialty} />

          <Text style={styles.label}>رقم هاتف العيادة للتواصل</Text>
          <TextInput style={styles.input} value={clinicPhone} onChangeText={setClinicPhone} placeholder="01xxxxxxxxx" placeholderTextColor="#64748B" />

          <Text style={styles.label}>عنوان العيادة التفصيلي</Text>
          <TextInput style={styles.input} value={clinicAddress} onChangeText={setClinicAddress} placeholder="المحافظة - الشارع - المبنى" placeholderTextColor="#64748B" />

          <Text style={styles.label}>شعار / لوجو العيادة (رفع ملف صورة مباشر):</Text>
          {Platform.OS === 'web' ? (
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleUploadLogoFile}
              style={{ marginBottom: 10, color: '#00F2FE' }}
            />
          ) : null}

          {uploadingLogo && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${logoUploadProgress}%` }]} />
              <Text style={styles.progressText}>جاري رفع وضغط الصورة... {logoUploadProgress}%</Text>
            </View>
          )}

          {clinicLogoUrl ? (
            <View style={styles.previewBox}>
              <Text style={styles.label}>معاينة اللوجو:</Text>
              <Image source={{ uri: clinicLogoUrl }} style={{ width: 90, height: 90 }} resizeMode="contain" />
              <TouchableOpacity onPress={() => setClinicLogoUrl('')} style={styles.deleteImgBtn}>
                <Text style={styles.deleteImgBtnText}>🗑️ حذف اللوجو</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity style={styles.saveProfileBtn} onPress={handleSaveProfile} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveProfileBtnText}>💾 حفظ وإعتماد بيانات الملف الشخصي</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowPrivacyModal(true)} style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: 'bold' }}>🛡️ سياسة الخصوصية وشروط الاستخدام</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TAB 2: PATIENTS */}
      {activeTab === 'patients' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📂 قائمة مرضى العيادة والملفات الطبية</Text>
          {loadingPatientsList ? (
            <ActivityIndicator color="#00F2FE" style={{ marginVertical: 20 }} />
          ) : allDoctorPatients.length === 0 ? (
            <Text style={styles.emptyText}>لا يوجد مرضى مسجلين حتى الآن.</Text>
          ) : (
            allDoctorPatients.map((item) => (
              <TouchableOpacity key={item.id} style={styles.patientListItem} onPress={() => selectPatientFromList(item)}>
                <View style={styles.rowInputs}>
                  <Text style={styles.patientItemName}>👤 {item.full_name}</Text>
                  <Text style={styles.patientItemCode}>{item.patient_code}</Text>
                </View>
                <Text style={styles.patientItemSub}>السن: {item.age || 'غير محدد'} | الهاتف: {item.phone || 'لا يوجد'}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* TAB 3: CONSULTATION & MULTI-SCANS */}
      {activeTab === 'prescription' && (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>👤 البيانات الأساسية لكارت المريض</Text>
              <TouchableOpacity style={styles.dummyBtn} onPress={handleFillDummyData}>
                <Text style={styles.dummyBtnText}>🧪 ملء بيانات تجريبية</Text>
              </TouchableOpacity>
            </View>

            {allDoctorPatients.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.label}>اختيار مريض محدد بكوده لإرفاق تقرير/أشعة له:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {allDoctorPatients.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.patientChip, selectedPatientCode === p.patient_code && styles.patientChipActive]}
                      onPress={() => selectPatientFromList(p)}
                    >
                      <Text style={[styles.patientChipText, selectedPatientCode === p.patient_code && styles.patientChipTextActive]}>
                        {p.full_name} ({p.patient_code})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            
            <Text style={styles.label}>اسم المريض بالكامل *</Text>
            <TextInput 
              style={styles.input} 
              placeholder="أدخل اسم المريض..." 
              placeholderTextColor="#64748B"
              value={patientName}
              onChangeText={handleSearchPatientByName}
            />

            {selectedPatientCode ? (
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.selectedCodeBadge}>📌 كود المريض المربوط: {selectedPatientCode}</Text>
                <TouchableOpacity onPress={handleSendWhatsAppPrescription} style={styles.whatsappShareBtn}>
                  <Text style={styles.whatsappShareBtnText}>💬 إرسال عبر الواتساب</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>السن</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="مثال: 58" 
                  placeholderTextColor="#64748B"
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
                  placeholderTextColor="#64748B"
                  keyboardType="phone-pad"
                  value={patientPhone}
                  onChangeText={setPatientPhone}
                />
              </View>
            </View>

            <Text style={styles.label}>الأمراض المزمنة</Text>
            <TextInput style={styles.input} placeholder="مثال: روماتويد، ضغط، سكر..." placeholderTextColor="#64748B" value={chronicDiseases} onChangeText={setChronicDiseases} />

            <Text style={styles.label}>التاريخ المرضي العائلي</Text>
            <TextInput style={styles.input} placeholder="مثال: أمراض مناعية..." placeholderTextColor="#64748B" value={familyHistoryText} onChangeText={setFamilyHistoryText} />
          </View>

          {patientName.trim() !== '' && (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>🖼️ شبكة أشعة ومرفقات المريض (Grid View)</Text>
                
                {searchingHistory ? (
                  <ActivityIndicator color="#00F2FE" style={{ marginVertical: 10 }} />
                ) : patientScansGrid.length === 0 ? (
                  <Text style={styles.emptyText}>لا توجد صور أشعة مرفوعة حالياً لـ {patientName}.</Text>
                ) : (
                  <View style={styles.scansGridContainer}>
                    {patientScansGrid.map((sc, idx) => (
                      <View key={idx} style={styles.scanGridCard}>
                        <TouchableOpacity onPress={() => { setViewingImageModal(sc); setZoomScale(1); }}>
                          {Platform.OS === 'web' ? (
                            <img 
                              src={sc.url} 
                              alt={sc.title} 
                              style={{ width: '100%', height: '90px', borderRadius: '8px', objectFit: 'cover' }} 
                            />
                          ) : (
                            <Image 
                              source={{ uri: sc.url }} 
                              style={styles.scanGridImg} 
                              resizeMode="cover"
                            />
                          )}
                        </TouchableOpacity>
                        <Text style={styles.scanGridTitle} numberOfLines={1}>{sc.title}</Text>
                        <TouchableOpacity 
                          style={styles.scanGridDeleteBtn}
                          onPress={() => handleDeleteSavedScanFromRecord(sc.recordId, sc.url)}
                        >
                          <Text style={styles.scanGridDeleteText}>🗑️ حذف</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.subSectionTitle}>➕ إضافة أشعات وفحوصات جديدة للمريض:</Text>
                
                {!isPatientSavedInDb && (
                  <View style={styles.warningInfoBox}>
                    <Text style={styles.warningInfoText}>
                      ⚠️ تنبيه: المريض جديد كلياً. يجب حفظ الكشف والتقرير أولاً لتوليد كود المريض قبل رفع وتثبيت الأشعات.
                    </Text>
                  </View>
                )}

                <TextInput 
                  style={[styles.input, !isPatientSavedInDb && styles.inputDisabled]} 
                  placeholder="عنوان المرفق (مثال: أشعة سينية جديدة)" 
                  placeholderTextColor="#64748B" 
                  value={scanGroupTitle} 
                  onChangeText={setScanGroupTitle}
                  editable={isPatientSavedInDb}
                />

                {Platform.OS === 'web' ? (
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    disabled={!isPatientSavedInDb}
                    onChange={handleSelectMultipleScans}
                    style={{ marginBottom: 12, color: isPatientSavedInDb ? '#00F2FE' : '#64748B', opacity: isPatientSavedInDb ? 1 : 0.4, cursor: isPatientSavedInDb ? 'pointer' : 'not-allowed' }}
                  />
                ) : null}

                {selectedScanFiles.length > 0 && (
                  <View style={{ marginBottom: 15 }}>
                    <Text style={styles.label}>معاينة الصور المختارة للرفع ({selectedScanFiles.length} صورة):</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {selectedScanFiles.map((item) => (
                        <View key={item.id} style={styles.scanPreviewCard}>
                          {Platform.OS === 'web' ? (
                            <img 
                              src={item.previewUrl} 
                              alt="preview" 
                              style={{ width: '100px', height: '100px', borderRadius: '6px', objectFit: 'cover' }} 
                            />
                          ) : (
                            <Image source={{ uri: item.previewUrl }} style={styles.scanPreviewImg} />
                          )}
                          <TouchableOpacity 
                            style={styles.deleteScanBtn}
                            onPress={() => handleRemoveSingleScan(item.id)}
                          >
                            <Text style={styles.deleteScanBtnText}>إزالة ✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {uploadingScans && (
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${scanUploadProgress}%` }]} />
                    <Text style={styles.progressText}>جاري رفع ومعالجة الصور... {scanUploadProgress}%</Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={[
                    styles.saveScansBtn, 
                    (!isPatientSavedInDb || uploadingScans) && styles.saveScansBtnDisabled
                  ]} 
                  onPress={handleSaveScansToPatientFile}
                  disabled={!isPatientSavedInDb || uploadingScans}
                >
                  {uploadingScans ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveScansBtnText}>
                      {isPatientSavedInDb ? '💾 حفظ وإضافة الأشاعات لملف المريض' : '🔒 زر الرفع مقفول (احفظ المريض أولاً)'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>📋 تاريخ الزيارات والروشتات المعتمدة السابقة</Text>
                {patientHistory.length === 0 ? (
                  <Text style={styles.emptyText}>لا توجد زيارات أو روشتات مسجلة سابقاً.</Text>
                ) : (
                  patientHistory.map((rec, rIdx) => (
                    <View key={rec.id || rIdx} style={styles.historyRecordCard}>
                      <Text style={styles.historyDate}>📅 زيارة بتاريخ: {new Date(rec.created_at || rec.visit_date).toLocaleDateString('ar-EG')}</Text>
                      <Text style={styles.historyDiagnosis}>التشخيص / البيان: {rec.diagnosis || 'فحص واكتشاف إكلينيكي'}</Text>
                    </View>
                  ))
                )}
              </View>
            </>
          )}

          {/* اختصاص الروماتيزم والمناعة: التاريخ المرضي (History) أولاً ثم الفحص الإكلينيكي (O/E) */}
          {isRheumaSpecialty && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>📋 التاريخ المرضي والفحص الإكلينيكي للروماتيزم والمناعة</Text>

              {/* القسم الأول: التاريخ المرضي والشكوى (History) */}
              <Text style={styles.subSectionTitle}>⏱️ أولاً: التاريخ المرضي والتيبس الصباحي (History & Morning Stiffness):</Text>
              <Text style={styles.label}>نوع التيبس الصباحي (اضغط للإلغاء إذا لم يوجد):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.stiffnessType.map((st, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.selectChip, stiffnessType === st && styles.selectChipActive]}
                    onPress={() => setStiffnessType(prev => prev === st ? '' : st)}
                  >
                    <Text style={[styles.selectChipText, stiffnessType === st && styles.selectChipTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {stiffnessType !== '' && (
                <>
                  <Text style={styles.label}>مدة التيبس الصباحي:</Text>
                  <View style={styles.chipsContainer}>
                    {RHEUMA_OPTIONS.stiffnessDuration.map((sd, i) => (
                      <TouchableOpacity key={i} style={[styles.selectChip, stiffnessDuration === sd && styles.selectChipActive]} onPress={() => setStiffnessDuration(sd)}>
                        <Text style={[styles.selectChipText, stiffnessDuration === sd && styles.selectChipTextActive]}>{sd}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>طبيعة الألم والشكوى (C/o Nature):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.diseaseNature.map((dn, i) => (
                  <TouchableOpacity key={i} style={[styles.selectChip, selectedDiseaseNature.includes(dn) && styles.selectChipActiveMulti]} onPress={() => toggleMultiSelect(dn, selectedDiseaseNature, setSelectedDiseaseNature)}>
                    <Text style={[styles.selectChipText, selectedDiseaseNature.includes(dn) && styles.selectChipTextActive]}>{selectedDiseaseNature.includes(dn) ? '✓ ' : ''}{dn}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* الأعراض والشكاوى الجهازية ضمن التاريخ المرضي */}
              <Text style={styles.subSectionTitle}>⚠️ الأعراض والشكاوى الجهازية خارج المفصل (Systemic Checklist):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.systemicChecklist.map((item) => (
                  <TouchableOpacity key={item.id} style={[styles.selectChip, selectedSystemicSigns.includes(item.id) && styles.selectChipActiveMulti]} onPress={() => toggleMultiSelect(item.id, selectedSystemicSigns, setSelectedSystemicSigns)}>
                    <Text style={[styles.selectChipText, selectedSystemicSigns.includes(item.id) && styles.selectChipTextActive]}>{selectedSystemicSigns.includes(item.id) ? '✓ ' : ''}{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* التاريخ العائلي المناعي ضمن التاريخ المرضي */}
              <Text style={styles.subSectionTitle}>👨‍👩‍👧‍👦 التاريخ العائلي والدوائي الخاص (Family History):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.familyHistoryChecklist.map((item) => (
                  <TouchableOpacity key={item.id} style={[styles.selectChip, selectedFamilySigns.includes(item.id) && styles.selectChipActiveMulti]} onPress={() => toggleMultiSelect(item.id, selectedFamilySigns, setSelectedFamilySigns)}>
                    <Text style={[styles.selectChipText, selectedFamilySigns.includes(item.id) && styles.selectChipTextActive]}>{selectedFamilySigns.includes(item.id) ? '✓ ' : ''}{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* القسم الثاني: خريطة الهيكل العظمي والفحص الفيزيائي (O/E) */}
              <Text style={styles.subSectionTitle}>🦴 ثانياً: خريطة استمارة العيادة لمفاصل الجسم (O/E Skeleton Map):</Text>
              <Text style={styles.label}>اختر نوع التحديد بالضغط أولاً، ثم انقر المفاصل على الرسمة (اضغط اليد أو القدم لتفصيل الأصابع):</Text>
              
              <View style={styles.jointModeSelectorRow}>
                <TouchableOpacity 
                  style={[styles.jointModeBtn, styles.jointModeBtnRed, jointSelectMode === 'inflamed' && styles.jointModeBtnActiveRed]} 
                  onPress={() => setJointSelectMode('inflamed')}
                >
                  <Text style={styles.jointModeBtnText}>🔴 مفصل ملتهب / متورم (Inflamed)</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.jointModeBtn, styles.jointModeBtnBlue, jointSelectMode === 'painful' && styles.jointModeBtnActiveBlue]} 
                  onPress={() => setJointSelectMode('painful')}
                >
                  <Text style={styles.jointModeBtnText}>🔵 مفصل مؤلم فقط (Painful / Tender)</Text>
                </TouchableOpacity>
              </View>

              {/* إطار رسمة استمارة عيادتك مقفول الأبعاد مع الصورة بنسبة 100% */}
              <View style={styles.skeletonOuterWrapper}>
                <View style={styles.skeletonCanvasBox}>
                  <Image 
                    source={{ uri: '/skeleton.png' }} 
                    style={styles.skeletonBaseImg} 
                    resizeMode="stretch" 
                  />
                  {SKELETON_JOINTS.map((joint) => {
                    const state = selectedJointStates[joint.id];
                    return (
                      <TouchableOpacity
                        key={joint.id}
                        style={[
                          styles.jointHotspotDot,
                          { left: `${joint.x}%`, top: `${joint.y}%` },
                          state === 'inflamed' && styles.dotRed,
                          state === 'painful' && styles.dotBlue,
                        ]}
                        onPress={() => handleJointClick(joint.id)}
                      />
                    );
                  })}
                </View>
              </View>

              {/* شريط التخصيص السريع للمفاصل الدقيقة عند اختيار اليد أو القدم */}
              {activeSubJointGroup && SUB_JOINTS_GROUPS[activeSubJointGroup] && (
                <View style={styles.subJointsDrawer}>
                  <View style={styles.subJointsHeaderRow}>
                    <Text style={styles.subJointsTitle}>🎯 {SUB_JOINTS_GROUPS[activeSubJointGroup].title}</Text>
                    <TouchableOpacity onPress={() => setActiveSubJointGroup(null)} style={styles.subJointsCloseBtn}>
                      <Text style={styles.subJointsCloseText}>إغلاق ✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.chipsContainer}>
                    {SUB_JOINTS_GROUPS[activeSubJointGroup].items.map((subItem) => {
                      const subState = selectedJointStates[subItem.id];
                      return (
                        <TouchableOpacity
                          key={subItem.id}
                          style={[
                            styles.subJointChip,
                            subState === 'inflamed' && styles.subJointChipRed,
                            subState === 'painful' && styles.subJointChipBlue,
                          ]}
                          onPress={() => handleSubJointToggle(subItem.id)}
                        >
                          <Text style={styles.subJointChipText}>
                            {subState === 'inflamed' ? '🔴 ' : subState === 'painful' ? '🔵 ' : '+ '}
                            {subItem.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <Text style={styles.label}>المفاصل المحددة حالياً (اضغط على المفصل لإزالته):</Text>
              <View style={styles.chipsContainer}>
                {Object.keys(selectedJointStates).length === 0 ? (
                  <Text style={styles.emptyText}>لم يتم تحديد أي مفصل على الرسمة بعد.</Text>
                ) : (
                  Object.entries(selectedJointStates).map(([id, state]) => {
                    const displayName = getJointDisplayName(id);
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[styles.selectedJointChip, state === 'inflamed' ? styles.chipRed : styles.chipBlue]}
                        onPress={() => handleRemoveSelectedJoint(id)}
                      >
                        <Text style={styles.selectedJointChipText}>
                          {state === 'inflamed' ? '🔴 ' : '🔵 '}{displayName} ✕
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {/* الفحوصات الفيزيائية السريعة (O/E Tests) */}
              <Text style={styles.subSectionTitle}>🔍 الفحص الفيزيائي المباشر (O/E Specific Tests):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.clinicalTests.map((t) => (
                  <TouchableOpacity key={t.id} style={[styles.selectChip, selectedClinicalTests.includes(t.id) && styles.selectChipActiveMulti]} onPress={() => toggleMultiSelect(t.id, selectedClinicalTests, setSelectedClinicalTests)}>
                    <Text style={[styles.selectChipText, selectedClinicalTests.includes(t.id) && styles.selectChipTextActive]}>{selectedClinicalTests.includes(t.id) ? '✓ ' : ''}{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* القسم الثالث: التحاليل والفحوصات المناعية (Serology) */}
              <Text style={styles.subSectionTitle}>🔬 ثالثاً: التحاليل المناعية ودلالات الالتهاب (Serology & Labs):</Text>

              <Text style={styles.label}>1. سرعة الترسيب والبروتين الالتهابي (ESR / CRP) - الأساس:</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.esrCrp.map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.selectChip, rheumaEsrCrp === opt && styles.selectChipActive]} onPress={() => setRheumaEsrCrp(opt)}>
                    <Text style={[styles.selectChipText, rheumaEsrCrp === opt && styles.selectChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>2. Anti-CCP:</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.antiCCP.map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.selectChip, rheumaAntiCCP === opt && styles.selectChipActive]} onPress={() => setRheumaAntiCCP(opt)}>
                    <Text style={[styles.selectChipText, rheumaAntiCCP === opt && styles.selectChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>3. Rheumatoid Factor (RF):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.rf.map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.selectChip, rheumaRF === opt && styles.selectChipActive]} onPress={() => setRheumaRF(opt)}>
                    <Text style={[styles.selectChipText, rheumaRF === opt && styles.selectChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>4. الأجسام المضادة للنوية (ANA):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.ana.map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.selectChip, rheumaANA === opt && styles.selectChipActive]} onPress={() => setRheumaANA(opt)}>
                    <Text style={[styles.selectChipText, rheumaANA === opt && styles.selectChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>5. أضداد الذئبة (Anti-dsDNA):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.antiDsDNA.map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.selectChip, rheumaAntiDsDNA === opt && styles.selectChipActive]} onPress={() => setRheumaAntiDsDNA(opt)}>
                    <Text style={[styles.selectChipText, rheumaAntiDsDNA === opt && styles.selectChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>6. تحاليل الأنسجة المتقدمة (Connective Tissue Profile):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.connectiveTissue.map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.selectChip, rheumaConnective === opt && styles.selectChipActive]} onPress={() => setRheumaConnective(opt)}>
                    <Text style={[styles.selectChipText, rheumaConnective === opt && styles.selectChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>7. أضداد الأنتيفوسفوليبيد (Anti-Phospholipid):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.antiPhospholipid.map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.selectChip, rheumaAPL === opt && styles.selectChipActive]} onPress={() => setRheumaAPL(opt)}>
                    <Text style={[styles.selectChipText, rheumaAPL === opt && styles.selectChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>8. فحص الأمان الكبدي والكلوي (Liver & Kidney Safety):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.organSafety.map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.selectChip, rheumaOrganSafety === opt && styles.selectChipActive]} onPress={() => setRheumaOrganSafety(opt)}>
                    <Text style={[styles.selectChipText, rheumaOrganSafety === opt && styles.selectChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>9. فحص الدرن وفيروسات الكبد (قبل البيولوجي):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.tbScreening.map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.selectChip, rheumaTbScreening === opt && styles.selectChipActive]} onPress={() => setRheumaTbScreening(opt)}>
                    <Text style={[styles.selectChipText, rheumaTbScreening === opt && styles.selectChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* تصنيف التشخيص المبدئي بأيقونات جاهزة + خانة إضافية مرنة */}
              <TouchableOpacity 
                style={[styles.queryCheckBtn, isQueryDiagnosis && styles.queryCheckBtnActive]} 
                onPress={() => setIsQueryDiagnosis(!isQueryDiagnosis)}
              >
                <Text style={styles.queryCheckBtnText}>
                  {isQueryDiagnosis ? '✓ ' : ''}🔍 تشخيص مبدئي / محتمل (Provisional / Query Diagnosis)
                </Text>
              </TouchableOpacity>

              {isQueryDiagnosis && (
                <View style={styles.provisionalBox}>
                  <Text style={styles.label}>اختر التشخيص المبدئي بنقرة واحدة (يمكن اختيار أكثر من اشتباه):</Text>
                  <View style={styles.chipsContainer}>
                    {RHEUMA_OPTIONS.provisionalDiagnoses.map((diag, idx) => {
                      const isSelected = selectedProvisionalChips.includes(diag);
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.selectChip, isSelected && styles.selectChipActiveMulti]}
                          onPress={() => toggleMultiSelect(diag, selectedProvisionalChips, setSelectedProvisionalChips)}
                        >
                          <Text style={[styles.selectChipText, isSelected && styles.selectChipTextActive]}>
                            {isSelected ? '✓ ' : ''}{diag}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.label}>إضافة اشتباه آخر غير موجود بالقائمة (اختياري):</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="اكتب أي تشخيص إضافي هنا..."
                    placeholderTextColor="#64748B"
                    value={provisionalDiagnosisText}
                    onChangeText={setProvisionalDiagnosisText}
                  />
                </View>
              )}
            </View>
          )}

          {/* الكارت المخصص لرفع صورة الأشعة/التحاليل للقراءة التلقائية المباشرة بالذكاء الاصطناعي */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📷 قراءة الأشعة ورقة التحاليل تلقائياً بالـ AI</Text>
            <Text style={styles.label}>ارفع ورقة التحليل أو الأشعة مباشرة ليقوم الذكاء الاصطناعي بقراءتها أثناء عملية التشخيص:</Text>
            
            {Platform.OS === 'web' ? (
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleSelectAiScanImage}
                style={{ marginBottom: 10, color: '#00F2FE' }}
              />
            ) : null}

            {aiScanPreviewUrl ? (
              <View style={styles.scanPreviewBox}>
                <Image source={{ uri: aiScanPreviewUrl }} style={{ width: 140, height: 140, borderRadius: 8 }} resizeMode="contain" />
                <TouchableOpacity onPress={() => { setAiScanFile(null); setAiScanPreviewUrl(''); setAiScanBase64(''); }} style={styles.deleteImgBtn}>
                  <Text style={styles.deleteImgBtnText}>🗑️ إزالة الصورة</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🩺 ملاحظات وتوجيهات إضافية (اختياري)</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="اختياري: أي ملاحظات سريرية أو شكاوى أخرى..." placeholderTextColor="#64748B" multiline numberOfLines={2} value={symptomsInput} onChangeText={setSymptomsInput} />

            <TouchableOpacity style={styles.aiButton} onPress={handleClinicalAnalysis} disabled={analyzing}>
              {analyzing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.aiButtonText}>✨ تحليل الحالة واقتراح الروشتة بالذكاء الاصطناعي ({specialty})</Text>}
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
                {aiReport.recommendedTests && aiReport.recommendedTests.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={{ color: '#00F2FE', fontSize: 11, fontWeight: 'bold' }}>🔬 التحاليل المطلوبة للتأكيد:</Text>
                    {aiReport.recommendedTests.map((t, idx) => <Text key={idx} style={{ color: '#CBD5E1', fontSize: 11 }}>• {t}</Text>)}
                  </View>
                )}
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
              <TextInput style={styles.input} placeholder="اسم الدواء (إنجليزي)" placeholderTextColor="#64748B" value={newMedName} onChangeText={setNewMedName} />
              <TextInput style={styles.input} placeholder="الجرعة والتوقيت" placeholderTextColor="#64748B" value={newMedDose} onChangeText={setNewMedDose} />
              <TextInput style={styles.input} placeholder="دواعي الاستعمال" placeholderTextColor="#64748B" value={newMedReason} onChangeText={setNewMedReason} />
              
              <TouchableOpacity style={styles.addMedBtn} onPress={handleCheckAndAddManualMed} disabled={checkingMed}>
                {checkingMed ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.addMedBtnText}>🔍 فحص وإضافة الدواء للروشتة</Text>}
              </TouchableOpacity>

              {medCheckError && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>🚨 تحذير تعارض: {medCheckError}</Text>
                  <View style={styles.overrideButtonsRow}>
                    <TouchableOpacity style={styles.forceAddBtn} onPress={handleForceAddMed}>
                      <Text style={styles.forceAddBtnText}>⚠️ أعلم المدى وأضيف على مسؤوليتي</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelAddBtn} onPress={handleDismissConflict}>
                      <Text style={styles.cancelAddBtnText}>✕ إلغاء وعدم الإضافة</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity style={[styles.saveButton, loading && styles.saveButtonDisabled]} onPress={handleSaveAndPrint} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>اعتماد التقرير وتنزيل الروشتة PDF 🖨️</Text>}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060911', padding: 14 },
  header: { marginBottom: 20, alignItems: 'center', marginTop: 10 },
  title: { 
    fontSize: 26, 
    fontWeight: '900', 
    color: '#00F2FE', 
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 242, 254, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 4, gap: 6 },
  brandTag: { fontSize: 10, color: '#64748B', fontWeight: 'bold', letterSpacing: 1 },
  brandSubtitle: { 
    fontSize: 13, 
    fontWeight: '900', 
    color: '#38BDF8', 
    letterSpacing: 2.5, 
    textShadowColor: 'rgba(56, 189, 248, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10 
  },
  subtitle: { fontSize: 12, color: '#94A3B8', marginTop: 3, fontWeight: '600', textAlign: 'center' },

  topUserRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', width: '100%', marginBottom: 12, alignItems: 'center' },
  userEmailText: { color: '#38BDF8', fontSize: 11, fontWeight: 'bold' },
  signOutBtn: { backgroundColor: '#1E293B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  signOutText: { color: '#EF4444', fontSize: 11, fontWeight: 'bold' },

  switchPortalBtn: { backgroundColor: '#1E293B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  switchPortalBtnText: { color: '#00F2FE', fontSize: 11, fontWeight: 'bold' },

  subWarningBanner: { backgroundColor: '#B45309', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, marginBottom: 15, flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderColor: '#F59E0B' },
  subWarningIcon: { fontSize: 16, marginLeft: 6 },
  subWarningText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', flex: 1, textAlign: 'right' },
  renewQuickBtn: { backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  renewQuickBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },

  authCard: { backgroundColor: '#0F172A', padding: 22, borderRadius: 18, borderWidth: 1, borderColor: '#1E293B', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
  authTitle: { fontSize: 20, fontWeight: 'bold', color: '#00F2FE', textAlign: 'center', marginBottom: 5 },
  authSub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 20 },
  authSubmitBtn: { backgroundColor: '#0284C7', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  authSubmitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  authToggleBtn: { marginTop: 15, alignItems: 'center' },
  authToggleBtnText: { color: '#38BDF8', fontSize: 12 },

  paywallCard: { backgroundColor: '#0F172A', padding: 20, borderRadius: 18, borderWidth: 1, borderColor: '#EF4444', alignItems: 'center' },
  paywallIcon: { fontSize: 40, marginBottom: 10 },
  paywallTitle: { fontSize: 20, fontWeight: 'bold', color: '#EF4444', marginBottom: 8 },
  paywallReason: { fontSize: 13, color: '#FCA5A5', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  paywallInfoBox: { backgroundColor: '#060911', padding: 15, borderRadius: 10, width: '100%', marginBottom: 15, borderWidth: 1, borderColor: '#1E293B' },
  paywallInfoTitle: { fontSize: 13, fontWeight: 'bold', color: '#38BDF8', marginBottom: 10, textAlign: 'right' },
  paymentMethodRow: { marginBottom: 12 },
  paymentMethodText: { fontSize: 12, color: '#CBD5E1', textAlign: 'right', marginBottom: 4 },
  paymentDetail: { fontSize: 14, fontWeight: 'bold', color: '#10B981', textAlign: 'right' },
  instaPayBtn: { backgroundColor: '#0284C7', padding: 8, borderRadius: 6, alignItems: 'center', marginTop: 4 },
  instaPayBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  paywallSubNote: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginBottom: 15, lineHeight: 18 },
  whatsappBtn: { backgroundColor: '#16A34A', padding: 14, borderRadius: 10, width: '100%', alignItems: 'center', marginBottom: 15 },
  whatsappBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  paywallSignOutBtn: { marginTop: 5 },

  navBar: { flexDirection: 'row-reverse', backgroundColor: '#0F172A', borderRadius: 12, padding: 4, marginBottom: 18, borderWidth: 1, borderColor: '#1E293B' },
  navBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  navBtnActive: { backgroundColor: '#0284C7' },
  navBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold' },
  navBtnTextActive: { color: '#FFFFFF' },

  card: { backgroundColor: '#0F172A', padding: 18, borderRadius: 18, marginBottom: 16, borderWidth: 1, borderColor: '#1E293B', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' },
  cardHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dummyBtn: { backgroundColor: '#0284C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  dummyBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 10, textAlign: 'right' },
  subSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#38BDF8', marginTop: 14, marginBottom: 8, textAlign: 'right' },
  label: { fontSize: 12, color: '#CBD5E1', marginBottom: 6, marginTop: 4, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#1E293B', borderRadius: 10, padding: 12, backgroundColor: '#060911', marginBottom: 12, textAlign: 'right', color: '#FFFFFF', fontSize: 13 },
  inputDisabled: { opacity: 0.5, backgroundColor: '#1E293B' },
  rowInputs: { flexDirection: 'row-reverse' },
  textArea: { height: 70, textAlignVertical: 'top' },
  
  specChip: { backgroundColor: '#060911', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#1E293B' },
  specChipActive: { backgroundColor: '#0284C7', borderColor: '#00F2FE' },
  specChipText: { color: '#94A3B8', fontSize: 11 },
  specChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },

  chipsContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  selectChip: { backgroundColor: '#060911', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#1E293B' },
  selectChipActive: { backgroundColor: '#0284C7', borderColor: '#00F2FE' },
  selectChipActiveMulti: { backgroundColor: '#047857', borderColor: '#10B981' },
  selectChipText: { color: '#94A3B8', fontSize: 11, textAlign: 'center' },
  selectChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },

  // --- أنماط خريطة استمارة العيادة للهيكل العظمي التفاعلية ---
  jointModeSelectorRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  jointModeBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  jointModeBtnRed: { backgroundColor: '#1E1111', borderColor: '#7F1D1D' },
  jointModeBtnActiveRed: { backgroundColor: '#991B1B', borderColor: '#EF4444' },
  jointModeBtnBlue: { backgroundColor: '#0C1A2E', borderColor: '#1E3A8A' },
  jointModeBtnActiveBlue: { backgroundColor: '#1D4ED8', borderColor: '#3B82F6' },
  jointModeBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },

  skeletonOuterWrapper: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginVertical: 10,
    overflow: 'hidden'
  },
  skeletonCanvasBox: {
    position: 'relative',
    width: '92%',
    maxWidth: 460,
    aspectRatio: 1.02,
  },
  skeletonBaseImg: {
    width: '100%',
    height: '100%'
  },
  jointHotspotDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    marginLeft: -8,
    marginTop: -8,
    borderRadius: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(2, 132, 199, 0.55)',
    cursor: 'pointer'
  },
  dotRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
    borderColor: '#991B1B',
    boxShadow: '0 0 8px #EF4444'
  },
  dotBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.92)',
    borderColor: '#1E3A8A',
    boxShadow: '0 0 8px #3B82F6'
  },

  // --- أنماط شريط التخصيص السريع للمفاصل الدقيقة ---
  subJointsDrawer: {
    backgroundColor: '#060911',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0284C7'
  },
  subJointsHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  subJointsTitle: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: 'bold'
  },
  subJointsCloseBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  subJointsCloseText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold'
  },
  subJointChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  subJointChipRed: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444'
  },
  subJointChipBlue: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6'
  },
  subJointChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold'
  },

  selectedJointChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginBottom: 4 },
  chipRed: { backgroundColor: '#7F1D1D', borderWidth: 1, borderColor: '#EF4444' },
  chipBlue: { backgroundColor: '#1E3A8A', borderWidth: 1, borderColor: '#3B82F6' },
  selectedJointChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },

  queryCheckBtn: { backgroundColor: '#1E293B', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155', alignItems: 'center', marginTop: 8 },
  queryCheckBtnActive: { backgroundColor: '#0284C7', borderColor: '#00F2FE' },
  queryCheckBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  provisionalBox: { backgroundColor: '#060911', padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#0284C7' },

  scanPreviewBox: { backgroundColor: '#060911', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#1E293B' },

  patientChip: { backgroundColor: '#060911', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 6, borderWidth: 1, borderColor: '#1E293B' },
  patientChipActive: { backgroundColor: '#0369A1', borderColor: '#00F2FE' },
  patientChipText: { color: '#CBD5E1', fontSize: 11 },
  patientChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  selectedCodeBadge: { color: '#10B981', fontSize: 11, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 },
  whatsappShareBtn: { backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
  whatsappShareBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },

  scanPreviewCard: { marginRight: 10, backgroundColor: '#060911', padding: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  scanPreviewImg: { width: 100, height: 100, borderRadius: 6 },
  deleteScanBtn: { backgroundColor: '#991B1B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginTop: 4 },
  deleteScanBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },

  scansGridContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  scanGridCard: { width: '31%', backgroundColor: '#060911', padding: 6, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  scanGridImg: { width: '100%', height: 90, borderRadius: 8, backgroundColor: '#1E293B' },
  scanGridTitle: { color: '#94A3B8', fontSize: 10, marginTop: 4, textAlign: 'center' },
  scanGridDeleteBtn: { backgroundColor: '#991B1B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, width: '100%', alignItems: 'center' },
  scanGridDeleteText: { color: '#FFFFFF', fontSize: 10 },

  progressBarContainer: { height: 18, backgroundColor: '#060911', borderRadius: 9, overflow: 'hidden', marginBottom: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#1E293B' },
  progressBarFill: { height: '100%', backgroundColor: '#059669', position: 'absolute' },
  progressText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', textAlign: 'center', zIndex: 1 },

  warningInfoBox: { backgroundColor: 'rgba(234, 179, 8, 0.15)', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#EAB308', marginBottom: 10 },
  warningInfoText: { color: '#FDE047', fontSize: 11, textAlign: 'right', lineHeight: 18 },

  saveScansBtn: { backgroundColor: '#10B981', padding: 14, borderRadius: 10, alignItems: 'center' },
  saveScansBtnDisabled: { backgroundColor: '#334155', opacity: 0.6 },
  saveScansBtnText: { color: '#FFFFFF', fontWeight: 'bold' , fontSize: 13 },

  deleteImgBtn: { backgroundColor: '#991B1B', padding: 6, borderRadius: 6, marginTop: 6, alignItems: 'center' },
  deleteImgBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },

  linkCardBox: { backgroundColor: '#060911', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#0284C7' },
  linkBoxTitle: { fontSize: 13, fontWeight: 'bold', color: '#00F2FE', textAlign: 'right' },
  linkBoxSub: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 2, marginBottom: 8 },
  copyLinkBtn: { backgroundColor: '#0284C7', padding: 10, borderRadius: 6, alignItems: 'center' },
  copyLinkBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },

  previewBox: { backgroundColor: '#060911', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#1E293B' },
  saveProfileBtn: { backgroundColor: '#10B981', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  saveProfileBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },

  patientListItem: { backgroundColor: '#060911', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#1E293B' },
  patientItemName: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' },
  patientItemCode: { fontSize: 12, color: '#00F2FE', fontWeight: 'bold' },
  patientItemSub: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 4 },
  emptyText: { color: '#64748B', fontSize: 12, textAlign: 'center', marginVertical: 10 },

  historyRecordCard: { backgroundColor: '#060911', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#1E293B' },
  historyDate: { color: '#38BDF8', fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  historyDiagnosis: { color: '#F8FAFC', fontSize: 13, marginTop: 4, textAlign: 'right' },

  aiButton: { backgroundColor: '#0284C7', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12, marginTop: 5 },
  aiButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  aiReportBox: { backgroundColor: 'rgba(3, 105, 161, 0.2)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#0284C7' },
  aiReportHeader: { fontSize: 12, fontWeight: 'bold', color: '#00F2FE', marginBottom: 6, textAlign: 'right' },
  warningBox: { backgroundColor: 'rgba(153, 27, 27, 0.4)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444', marginTop: 6, marginBottom: 6 },
  warningText: { color: '#FCA5A5', fontSize: 11, fontWeight: 'bold', textAlign: 'right', lineHeight: 18 },
  overrideButtonsRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  forceAddBtn: { flex: 1.4, backgroundColor: '#DC2626', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 6, alignItems: 'center' },
  forceAddBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  cancelAddBtn: { flex: 1, backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 6, alignItems: 'center' },
  cancelAddBtnText: { color: '#CBD5E1', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },

  aiDiagText: { fontSize: 12, color: '#F8FAFC', textAlign: 'right' },
  medCard: { backgroundColor: '#060911', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1E293B', marginBottom: 10 },
  medHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  medName: { fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' },
  deleteText: { color: '#EF4444', fontSize: 11, fontWeight: 'bold' },
  medDetail: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 2 },
  addMedBox: { backgroundColor: '#060911', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#1E293B' },
  addMedBtn: { backgroundColor: '#1E293B', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 4 },
  addMedBtnText: { color: '#00F2FE', fontSize: 12, fontWeight: 'bold' },
  saveButton: { backgroundColor: '#10B981', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 35 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  lightboxCloseBtn: { position: 'absolute', top: 20, right: 20, backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, zIndex: 10 },
  lightboxCloseText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  lightboxControls: { position: 'absolute', bottom: 30, flexDirection: 'row-reverse', gap: 10, zIndex: 10 },
  zoomBtn: { backgroundColor: '#0284C7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  zoomBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  lightboxTitle: { color: '#00F2FE', fontSize: 13, fontWeight: 'bold', marginTop: 12, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#0F172A', padding: 20, borderRadius: 16, width: '100%', maxWidth: 450, borderWidth: 1, borderColor: '#EF4444' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#EF4444', marginBottom: 8, textAlign: 'right' },
  modalSub: { fontSize: 13, color: '#CBD5E1', marginBottom: 20, textAlign: 'right', lineHeight: 20 },
  modalButtonsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  modalStayBtn: { flex: 1, backgroundColor: '#1E293B', padding: 10, borderRadius: 8, alignItems: 'center' },
  modalStayBtnText: { color: '#94A3B8', fontSize: 11, fontWeight: 'bold' },
  modalGoBtn: { flex: 1.2, backgroundColor: '#0284C7', padding: 10, borderRadius: 8, alignItems: 'center' },
  modalGoBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' }
});
