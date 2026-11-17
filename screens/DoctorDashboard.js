import React, { useState, useEffect, useRef } from 'react';
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

// --- خيارات الفحص السريع وقوائم الشكاوى التخصصية (مبسطة للتحاليل الأساسية المرتبة فقط) ---
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
  esrCrp: ["طبيعي (Normal)", "مرتفع بدرجة متوسطة (Moderate)", "مرتفع جداً (High Active Flare)"],
  rf: ["سلبي (Negative)", "إيجابي ضعيف (+)", "إيجابي مرتفع (+++)"],
  antiCCP: ["سلبي (Negative)", "إيجابي (+) < 3x", "إيجابي مرتفع (+++) > 3x"],
  ana: ["سلبي (Negative)", "إيجابي Homogeneous", "إيجابي Speckled", "إيجابي Nucleolar"],
  antiDsDNA: ["سلبي (Negative)", "إيجابي مرتفع (Positive)"],
  organAndViralSafety: [
    "كلى وكبد وفيروسات سليمة (Safe)",
    "ارتفاع إنزيمات الكبد (Elevated LFTs)",
    "قصور وظائف الكلى (Renal Impairment)",
    "إيجابي فيروسات كبدية (HBV / HCV +)"
  ]
};

// --- حساب نشاط مرض الروماتويد التلقائي (DAS28-ESR / DAS28-CRP / CDAI) ---
const calculateRheumaActivityScore = (jointStates, esrVal, crpVal, vasVal = 40) => {
  const uniqueRegions = new Set();
  Object.entries(jointStates || {}).forEach(([id, state]) => {
    const cleanKey = id
      .replace(/^Ant_/, '')
      .replace(/^Post_/, '')
      .replace(/^Sub_/, '');
    uniqueRegions.add(`${cleanKey}:${state}`);
  });

  let swollenCount = 0;
  let tenderOnlyCount = 0;
  uniqueRegions.forEach(entry => {
    if (entry.endsWith(':inflamed')) swollenCount++;
    else if (entry.endsWith(':painful')) tenderOnlyCount++;
  });

  // في مقياس DAS28، المفصل المتورم يُعدّ مؤلماً ضمن إجمالي TJC
  const totalTJC = tenderOnlyCount + swollenCount;
  const totalSJC = swollenCount;
  const esr = parseFloat(esrVal);
  const crp = parseFloat(crpVal);
  const vas = Math.min(Math.max(parseFloat(vasVal) || 40, 0), 100);

  if (!isNaN(esr) && esr > 0) {
    const das28 =
      0.56 * Math.sqrt(totalTJC) +
      0.28 * Math.sqrt(totalSJC) +
      0.70 * Math.log(esr) +
      0.014 * vas;
    const score = Number(das28.toFixed(2));
    let level = 'هدوء المرض (Remission < 2.6)';
    let color = '#10B981';
    if (score >= 5.1) {
      level = 'نشاط مرتفع جداً (High Activity > 5.1)';
      color = '#EF4444';
    } else if (score >= 3.2) {
      level = 'نشاط متوسط (Moderate Activity 3.2 - 5.1)';
      color = '#F59E0B';
    } else if (score >= 2.6) {
      level = 'نشاط منخفض (Low Activity 2.6 - 3.2)';
      color = '#38BDF8';
    }
    return { formula: 'DAS28-ESR', score, level, color, swollenCount: totalSJC, tenderCount: totalTJC };
  }

  if (!isNaN(crp) && crp >= 0) {
    const das28Crp =
      0.56 * Math.sqrt(totalTJC) +
      0.28 * Math.sqrt(totalSJC) +
      0.36 * Math.log(crp + 1) +
      0.014 * vas +
      0.96;
    const score = Number(das28Crp.toFixed(2));
    let level = 'هدوء المرض (Remission < 2.6)';
    let color = '#10B981';
    if (score >= 5.1) {
      level = 'نشاط مرتفع جداً (High Activity > 5.1)';
      color = '#EF4444';
    } else if (score >= 3.2) {
      level = 'نشاط متوسط (Moderate Activity 3.2 - 5.1)';
      color = '#F59E0B';
    } else if (score >= 2.6) {
      level = 'نشاط منخفض (Low Activity 2.6 - 3.2)';
      color = '#38BDF8';
    }
    return { formula: 'DAS28-CRP', score, level, color, swollenCount: totalSJC, tenderCount: totalTJC };
  }

  // CDAI السريري في حال عدم إدخال ESR أو CRP
  const cdai = Number((totalTJC + totalSJC + (vas / 10) * 2).toFixed(1));
  let level = 'هدوء سريري (CDAI Remission ≤ 2.8)';
  let color = '#10B981';
  if (cdai > 22) {
    level = 'نشاط سريري مرتفع (High CDAI > 22)';
    color = '#EF4444';
  } else if (cdai > 10) {
    level = 'نشاط سريري متوسط (Moderate CDAI 10 - 22)';
    color = '#F59E0B';
  } else if (cdai > 2.8) {
    level = 'نشاط سريري منخفض (Low CDAI 2.8 - 10)';
    color = '#38BDF8';
  }
  return { formula: 'CDAI (سريري)', score: cdai, level, color, swollenCount: totalSJC, tenderCount: totalTJC };
};

// --- مكون التلميح الإرشادي البسيط لتوضيح عمل كل قسم ---
const ClinicalHint = ({ text }) => (
  <View style={styles.hintBanner}>
    <Text style={styles.hintBannerIcon}>💡</Text>
    <Text style={styles.hintBannerText}>{text}</Text>
  </View>
);

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

const revokeBlobUrlSafely = (url) => {
  if (Platform.OS === 'web' && url && typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
  }
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

  // --- حالات التحديث للروماتيزم والمناعة ---
  const [selectedJointStates, setSelectedJointStates] = useState({}); // { JointID: 'inflamed' | 'painful' }
  const [jointSelectMode, setJointSelectMode] = useState('inflamed'); // 'inflamed' (أحمر) أو 'painful' (أزرق)
  const [activeSubJointGroup, setActiveSubJointGroup] = useState(null); // 'R_Hand' | 'L_Hand' | 'R_Foot' | 'L_Foot' | null
  const [stiffnessType, setStiffnessType] = useState('');
  const [stiffnessDuration, setStiffnessDuration] = useState('نصف ساعة أو أكثر');
  const [selectedDiseaseNature, setSelectedDiseaseNature] = useState([]);
  const [selectedSystemicSigns, setSelectedSystemicSigns] = useState([]);
  const [selectedFamilySigns, setSelectedFamilySigns] = useState([]);
  const [selectedClinicalTests, setSelectedClinicalTests] = useState([]);

  // التحاليل الأساسية المرتبة فقط (بدون تشتيت)
  const [rheumaEsrCrp, setRheumaEsrCrp] = useState('');
  const [rheumaRF, setRheumaRF] = useState('');
  const [rheumaAntiCCP, setRheumaAntiCCP] = useState('');
  const [rheumaANA, setRheumaANA] = useState('');
  const [rheumaAntiDsDNA, setRheumaAntiDsDNA] = useState('');
  const [rheumaOrganSafety, setRheumaOrganSafety] = useState('');

  // --- مدخلات حاسبة نشاط المرض التلقائية (DAS28 / CDAI) ---
  const [dasEsrInput, setDasEsrInput] = useState('');
  const [dasCrpInput, setDasCrpInput] = useState('');
  const [dasVasInput, setDasVasInput] = useState('40');

  const [isQueryDiagnosis, setIsQueryDiagnosis] = useState(false);
  const [selectedProvisionalChips, setSelectedProvisionalChips] = useState([]);
  const [provisionalDiagnosisText, setProvisionalDiagnosisText] = useState('');

  // --- المرحلة 3 + جدول استخراج التحاليل والأشعة التلقائي من الصور ---
  // aiScanItems: [{ id, blob, previewUrl, base64, title, remoteUrl? }]
  const [aiScanItems, setAiScanItems] = useState([]);
  const [processingAiImages, setProcessingAiImages] = useState(false);
  const [savingAiScansDirectly, setSavingAiScansDirectly] = useState(false);
  const [manualLabsUnlocked, setManualLabsUnlocked] = useState(false);

  // --- جدول نتائج التحاليل والأشعة المستخرج من الصور (Editable Structured Table) ---
  const [extractedLabs, setExtractedLabs] = useState([]);
  const [extractedRadiologyNotes, setExtractedRadiologyNotes] = useState('');
  const [extractingLabsTable, setExtractingLabsTable] = useState(false);
  const [labsExtractionError, setLabsExtractionError] = useState('');
  const [showPrevLabsComparison, setShowPrevLabsComparison] = useState(false);
  const [includeLabsInPdf, setIncludeLabsInPdf] = useState(false);
  const lastExtractedSignatureRef = useRef('');

  // --- حالات نافذة الكاميرا الحية المدمجة للكمبيوتر واللابتوب (USB / External Webcam) ---
  const [showLiveCameraModal, setShowLiveCameraModal] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraStarting, setCameraStarting] = useState(false);
  const liveVideoRef = useRef(null);
  const liveStreamRef = useRef(null);

  // --- حالات نافذة ربط كاميرا الهاتف الذكي عبر QR Code (Live Session Bridge) ---
  const [showQrBridgeModal, setShowQrBridgeModal] = useState(false);
  const [qrBridgeSessionId, setQrBridgeSessionId] = useState('');
  const [qrReceivedCount, setQrReceivedCount] = useState(0);
  const [qrSyncStatus, setQrSyncStatus] = useState('في انتظار مسح رمز الـ QR بكاميرا الهاتف...');
  const syncedQrItemIdsRef = useRef(new Set());

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
  const hasAiScanImages = aiScanItems.length > 0;
  const isManualLabsLocked = hasAiScanImages && !manualLabsUnlocked;

  const rheumaActivityResult = calculateRheumaActivityScore(
    selectedJointStates,
    dasEsrInput,
    dasCrpInput,
    dasVasInput
  );

  // حساب عدد المفاصل المتورمة والمؤلمة بدقة للعرض الفوري
  const inflamedCountDisplay = rheumaActivityResult.swollenCount;
  const tenderOnlyCountDisplay = Math.max(0, rheumaActivityResult.tenderCount - rheumaActivityResult.swollenCount);

  const toggleMultiSelect = (item, currentList, setter) => {
    if (currentList.includes(item)) setter(currentList.filter(i => i !== item));
    else setter([...currentList, item]);
  };

  const toggleSingleChip = (val, currentVal, setter) => {
    setter(currentVal === val ? '' : val);
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

  // =========================================================================
  // جزء الكاميرا وربط QR بالكامل (كما هو بدون لمس أو تغيير)
  // =========================================================================
  const stopLiveCameraStream = () => {
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach(track => track.stop());
      liveStreamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  };

  const startLiveCameraStream = async (preferredDeviceId = '') => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setCameraError('الكاميرا الحية مدعومة في متصفح الويب على الكمبيوتر واللابتوب.');
      return;
    }
    setCameraStarting(true);
    setCameraError('');
    stopLiveCameraStream();

    try {
      const videoConstraints = preferredDeviceId
        ? { deviceId: { exact: preferredDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { width: { ideal: 1920 }, height: { ideal: 1080 } };

      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      liveStreamRef.current = stream;

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => {});
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setCameraDevices(videoInputs);

      const activeTrack = stream.getVideoTracks()[0];
      const activeSettings = activeTrack ? activeTrack.getSettings() : {};
      if (activeSettings.deviceId) {
        setSelectedCameraId(activeSettings.deviceId);
      } else if (videoInputs.length > 0 && !preferredDeviceId) {
        setSelectedCameraId(videoInputs[0].deviceId);
      }
    } catch (err) {
      setCameraError(`تعذر تشغيل الكاميرا: ${err.message || 'تأكد من توصيل الكاميرا ومنح صلاحية الوصول للمتصفح.'}`);
    } finally {
      setCameraStarting(false);
    }
  };

  const handleOpenLiveCameraModal = () => {
    setShowLiveCameraModal(true);
    setTimeout(() => {
      startLiveCameraStream(selectedCameraId);
    }, 150);
  };

  const handleCloseLiveCameraModal = () => {
    stopLiveCameraStream();
    setShowLiveCameraModal(false);
    setCameraError('');
  };

  const handleSwitchCameraDevice = (newDeviceId) => {
    setSelectedCameraId(newDeviceId);
    startLiveCameraStream(newDeviceId);
  };

  const handleCaptureFromLiveCamera = async () => {
    const videoEl = liveVideoRef.current;
    if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) {
      showAlert('تنبيه', 'الكاميرا لم تكتمل تهيئتها بعد، انتظر لحظة ثم اضغط التقاط.');
      return;
    }

    setProcessingAiImages(true);
    try {
      const rawCanvas = document.createElement('canvas');
      rawCanvas.width = videoEl.videoWidth;
      rawCanvas.height = videoEl.videoHeight;
      const ctx = rawCanvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, rawCanvas.width, rawCanvas.height);

      const rawBlob = await new Promise(resolve => rawCanvas.toBlob(resolve, 'image/jpeg', 0.96));
      if (!rawBlob) throw new Error('فشل التقاط الإطار من الكاميرا');

      const enhanced = await enhanceScanImageForAI(rawBlob, 2800, 0.95);
      const captureNumber = aiScanItems.length + 1;
      const newItem = {
        id: `cam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        blob: enhanced.blob,
        previewUrl: enhanced.base64 || enhanced.previewUrl,
        base64: enhanced.base64,
        title: `لقطة كاميرا مباشرة #${captureNumber}`
      };

      setAiScanItems(prev => {
        if (prev.length === 0) {
          setManualLabsUnlocked(false);
        }
        return [...prev, newItem];
      });
    } catch (err) {
      showAlert('خطأ في الالتقاط', err.message || 'تعذر التقاط الصورة من الكاميرا.');
    } finally {
      setProcessingAiImages(false);
    }
  };

  useEffect(() => {
    return () => {
      stopLiveCameraStream();
    };
  }, []);

  // --- دوال إدارة نافذة ربط كاميرا الهاتف الذكي عبر QR Code والمزامنة اللحظية (qr_session_photos + Storage) ---
  const handleOpenQrBridgeModal = () => {
    const sessionCode = `SCAN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    syncedQrItemIdsRef.current = new Set();
    setQrBridgeSessionId(sessionCode);
    setQrReceivedCount(0);
    setQrSyncStatus('امسح رمز الـ QR بكاميرا هاتفك، وكل دفعة صور ترسلها من هاتفك ستظهر هنا فوراً...');
    setShowQrBridgeModal(true);
  };

  const handleCloseQrBridgeModal = () => {
    setShowQrBridgeModal(false);
  };

  useEffect(() => {
    if (!showQrBridgeModal || !qrBridgeSessionId) return;

    let isCancelled = false;

    const convertUrlToBase64 = async (imageUrl) => {
      try {
        const res = await fetch(imageUrl, { mode: 'cors' });
        if (!res.ok) throw new Error('Fetch failed');
        const blob = await res.blob();
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        return { blob, base64 };
      } catch (e) {
        return { blob: null, base64: imageUrl };
      }
    };

    const pollQrPhotos = async () => {
      try {
        const newBatchItems = [];

        // 1. الاستعلام المباشر من جدول قاعدة البيانات qr_session_photos (المطابق لتحديث App.js)
        const { data: dbRows, error: dbErr } = await supabase
          .from('qr_session_photos')
          .select('*')
          .eq('session_id', qrBridgeSessionId)
          .order('created_at', { ascending: true });

        if (!dbErr && Array.isArray(dbRows) && dbRows.length > 0) {
          for (let i = 0; i < dbRows.length; i++) {
            const row = dbRows[i];
            const rowKey = String(row.id || row.photo_url || row.url);
            if (!rowKey || syncedQrItemIdsRef.current.has(rowKey)) continue;

            const photoUrl = row.photo_url || row.url || row.image_url;
            if (!photoUrl) continue;

            syncedQrItemIdsRef.current.add(rowKey);
            const { blob, base64 } = await convertUrlToBase64(photoUrl);
            newBatchItems.push({
              id: `qr_db_${rowKey}`,
              blob: blob,
              previewUrl: base64 || photoUrl,
              base64: base64 || photoUrl,
              remoteUrl: photoUrl,
              title: row.title || `صورة من الهاتف #${syncedQrItemIdsRef.current.size}`
            });
          }
        }

        // 2. قراءة احتياطية مباشرة من مجلد التخزين qr_sessions/${qrBridgeSessionId} في clinic-assets
        const folderPath = `qr_sessions/${qrBridgeSessionId}`;
        const { data: storageFiles, error: listErr } = await supabase.storage
          .from('clinic-assets')
          .list(folderPath, { limit: 100, sortBy: { column: 'name', order: 'asc' } });

        if (!listErr && Array.isArray(storageFiles) && storageFiles.length > 0) {
          for (let i = 0; i < storageFiles.length; i++) {
            const fileObj = storageFiles[i];
            if (!fileObj?.name || fileObj.name === 'manifest.json' || fileObj.name.startsWith('.')) continue;

            const fullPath = `${folderPath}/${fileObj.name}`;
            const { data: urlData } = supabase.storage.from('clinic-assets').getPublicUrl(fullPath);
            const publicUrl =
              urlData?.publicUrl ||
              `https://emynlqikbdwogijqfbfw.supabase.co/storage/v1/object/public/clinic-assets/${fullPath}`;

            const storageKey = fileObj.id || fileObj.name;
            const isAlreadySyncedByUrl = newBatchItems.some(it => it.remoteUrl === publicUrl);
            if (syncedQrItemIdsRef.current.has(storageKey) || syncedQrItemIdsRef.current.has(publicUrl) || isAlreadySyncedByUrl) {
              continue;
            }

            syncedQrItemIdsRef.current.add(storageKey);
            syncedQrItemIdsRef.current.add(publicUrl);
            const { blob, base64 } = await convertUrlToBase64(publicUrl);
            newBatchItems.push({
              id: `qr_st_${Date.now()}_${i}`,
              blob: blob,
              previewUrl: base64 || publicUrl,
              base64: base64 || publicUrl,
              remoteUrl: publicUrl,
              title: `صورة من الهاتف #${syncedQrItemIdsRef.current.size}`
            });
          }
        }

        if (newBatchItems.length > 0 && !isCancelled) {
          setAiScanItems(prev => {
            if (prev.length === 0) {
              setManualLabsUnlocked(false);
            }
            return [...prev, ...newBatchItems];
          });
          setQrReceivedCount(prevCount => {
            const updatedTotal = prevCount + newBatchItems.length;
            setQrSyncStatus(`✅ تم استلام (${newBatchItems.length}) صورة جديدة من الهاتف (الإجمالي: ${updatedTotal}) وإضافتها للمعاينة فوراً!`);
            return updatedTotal;
          });
        }
      } catch (e) {
        // استمرار الفحص اللحظي بهدوء
      }
    };

    pollQrPhotos();
    const intervalId = setInterval(pollQrPhotos, 1500);
    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [showQrBridgeModal, qrBridgeSessionId]);

  const qrTargetUrl = (() => {
    if (!qrBridgeSessionId) return '';
    const origin =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin.split('?')[0]
        : 'https://medverse-emr-suite.vercel.app';
    return `${origin}?scan_session=${encodeURIComponent(qrBridgeSessionId)}`;
  })();

  const qrCodeImageUrl = qrTargetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(qrTargetUrl)}`
    : '';
  // =========================================================================

  // --- استخراج جدول التحاليل (OCR) + القراءة البصرية المباشرة لأفلام الأشعة (Multimodal Vision AI) ---
  const handleExtractStructuredLabsFromImages = async (itemsToRead = aiScanItems) => {
    if (!itemsToRead || itemsToRead.length === 0) return;

    setExtractingLabsTable(true);
    setLabsExtractionError('');

    const loadTesseractScript = () => {
      return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') return reject(new Error('مدعوم على الويب فقط'));
        if (window.Tesseract) return resolve(window.Tesseract);
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.onload = () => resolve(window.Tesseract);
        script.onerror = () => reject(new Error('تعذر تحميل محرك القراءة البصرية OCR، تأكد من الاتصال بالإنترنت.'));
        document.head.appendChild(script);
      });
    };

    // 1. تجهيز نسخة أبيض وأسود عالية التباين لقراءة أرقام التحاليل بدقة
    const prepareHighContrastOcrImage = (srcUrl) => {
      return new Promise((resolve) => {
        if (Platform.OS !== 'web' || !srcUrl || typeof srcUrl !== 'string') {
          return resolve(srcUrl);
        }
        try {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const scale = img.width < 2000 ? 2 : 1;
            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            if (typeof ctx.filter !== 'undefined') {
              ctx.filter = 'grayscale(100%) contrast(1.45) brightness(1.05)';
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => resolve(srcUrl);
          img.src = srcUrl;
        } catch (e) {
          resolve(srcUrl);
        }
      });
    };

    // 2. تجهيز نسخة JPEG واضحة لإرسالها لنموذج الرؤية البصرية لقراءة أفلام الأشعة (X-Ray / MRI / US)
    const prepareImageForVisionAI = (srcUrl, maxDim = 1280) => {
      return new Promise((resolve) => {
        if (Platform.OS !== 'web' || !srcUrl || typeof srcUrl !== 'string') {
          return resolve(srcUrl);
        }
        try {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              let w = img.width;
              let h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                } else {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL('image/jpeg', 0.9));
            } catch (canvasErr) {
              resolve(srcUrl);
            }
          };
          img.onerror = () => resolve(srcUrl);
          img.src = srcUrl;
        } catch (e) {
          resolve(srcUrl);
        }
      });
    };

    // 3. دالة تحليل أفلام الأشعة بصرياً عبر نموذج Groq Vision وربطها بمواضع الألم على الخريطة
    const analyzeRadiologyFilmsWithVision = async (visionImages) => {
      if (!visionImages || visionImages.length === 0) return '';

      const activeJointsContext = Object.entries(selectedJointStates || {})
        .map(([id, state]) => `${getJointDisplayName(id)} (${state === 'inflamed' ? 'Swollen/Red' : 'Painful/Blue'})`)
        .join(', ');

      const visionPrompt = `You are an expert Musculoskeletal & Clinical Radiologist AI assisting a physician (${specialty}).
Analyze the attached medical imaging scan(s) (X-Ray, MRI, Ultrasound, or CT) visually in detail.
Patient Context: Age ${age || 'Unspecified'}, Gender: ${gender}, Chronic Diseases: ${chronicDiseases || 'None'}.
Doctor's Selected Painful/Swollen Joints on Skeleton Map: ${activeJointsContext || 'None specified yet'}.

Instructions:
1. Identify the anatomical region and imaging modality visible in each image.
2. Describe key radiological findings objectively (e.g., joint space narrowing, marginal bone erosions, periarticular osteopenia, osteophytes, subchondral sclerosis, sacroiliitis, soft tissue swelling, alignment, or normal appearance).
3. Correlate findings with the doctor's selected painful/swollen joints if applicable.
4. Write a clear, concise, professional summary in Arabic with key English radiological terms in parentheses. Do NOT return JSON, return clean structured text only.`;

      const userContentArray = [
        { type: 'text', text: visionPrompt },
        ...visionImages.map(imgDataUrl => ({
          type: 'image_url',
          image_url: { url: imgDataUrl }
        }))
      ];

      const visionModels = [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'meta-llama/llama-4-maverick-17b-128e-instruct'
      ];

      for (const modelName of visionModels) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: 'user', content: userContentArray }],
              temperature: 0.1
            })
          });
          if (res.ok) {
            const vData = await res.json();
            const vText = vData?.choices?.[0]?.message?.content?.trim();
            if (vText) return vText;
          }
        } catch (e) {
          // الانتقال للنموذج الاحتياطي
        }
      }
      return '';
    };

    const extractionSystemPrompt = `You are a strict Medical Laboratory & Radiology OCR Parser.
You will receive raw OCR text extracted from medical lab reports and written radiology reports.
CRITICAL RULES:
1. Extract ONLY exact numbers and reference ranges explicitly present in the OCR text. NEVER invent or assume standard reference ranges if a range is written in the text (e.g., if the text says 0 - 15, output "0 - 15", NOT "0 - 20").
2. Compare the extracted numeric value against the extracted reference range accurately to set "status" ("High", "Low", "Normal", "Positive", "Negative"). For example, if value is 25 and referenceRange is "0 - 15", status MUST be "High".
3. Do NOT confuse patient age, date (e.g. 17/11/2026), or phone numbers with lab test results.
4. Fix minor OCR typos in medical test names only (e.g., E5R -> ESR, CRp -> CRP).
Respond ONLY with a valid JSON object without Markdown formatting:
{
  "labs": [
    {
      "testName": "Erythrocyte Sedimentation Rate (ESR)",
      "value": "25",
      "unit": "mm/hr",
      "referenceRange": "0 - 15",
      "status": "High"
    }
  ],
  "radiologySummary": "ملخص تقرير الأشعة المكتوب بالعربي أو الإنجليزي إن وجد، أو نص فارغ إذا كانت الصور تحاليل فقط"
}`;

    try {
      const Tesseract = await loadTesseractScript();
      const worker = await Tesseract.createWorker('eng');
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1'
      });

      let combinedOcrText = '';
      const visionCandidateImages = [];

      for (let i = 0; i < itemsToRead.length; i++) {
        const item = itemsToRead[i];
        const rawSrc = item.base64 || item.previewUrl || item.remoteUrl;
        if (!rawSrc) continue;

        const processedSrc = await prepareHighContrastOcrImage(rawSrc);
        const { data: { text } } = await worker.recognize(processedSrc);
        const cleanText = (text || '').trim();
        const alphaNumCount = cleanText.replace(/[^a-zA-Z0-9]/g, '').length;
        const isRadiologyTitle = /x-?ray|mri|ct|scan|ultrasound|أشعة|رنين|مقطعية|سونار/i.test(item.title || '');

        if (alphaNumCount >= 35) {
          combinedOcrText += `\n--- Document ${i + 1} (${item.title || 'Report'}) ---\n${cleanText}\n`;
        }

        // إذا كانت الصورة فيلم أشعة (نصها قليل جداً أو عنوانها يدل على أشعة) نجهزها للرؤية البصرية المباشرة
        if (alphaNumCount < 60 || isRadiologyTitle) {
          const visionReadyUrl = await prepareImageForVisionAI(rawSrc);
          if (visionReadyUrl && (visionReadyUrl.startsWith('data:image') || visionReadyUrl.startsWith('http'))) {
            visionCandidateImages.push(visionReadyUrl);
          }
        }
      }
      await worker.terminate();

      let parsedLabs = [];
      let textRadiologySummary = '';

      // أ) استخراج جدول التحاليل والتقارير المكتوبة إن وجد نص
      if (combinedOcrText.trim()) {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            messages: [
              { role: "system", content: extractionSystemPrompt },
              { role: "user", content: `Parse the following raw OCR text from ${itemsToRead.length} medical document(s) into structured JSON without guessing values:\n${combinedOcrText}` }
            ],
            temperature: 0.0
          })
        });

        if (response.ok) {
          const data = await response.json();
          const rawContent = data?.choices?.[0]?.message?.content || '{}';
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          const cleanJson = jsonMatch
            ? jsonMatch[0]
            : rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);

          parsedLabs = Array.isArray(parsed.labs)
            ? parsed.labs.map((r, idx) => ({
                id: `lab_${Date.now()}_${idx}`,
                testName: r.testName || '',
                value: String(r.value ?? ''),
                unit: r.unit || '',
                referenceRange: r.referenceRange || '',
                status: r.status || 'Normal'
              }))
            : [];
          textRadiologySummary = (parsed.radiologySummary || '').trim();
        }
      }

      // ب) القراءة البصرية لأفلام الأشعة (X-Ray / MRI) عبر نموذج الرؤية
      let visualRadiologyReading = '';
      if (visionCandidateImages.length > 0) {
        visualRadiologyReading = await analyzeRadiologyFilmsWithVision(visionCandidateImages);
      }

      if (parsedLabs.length === 0 && !textRadiologySummary && !visualRadiologyReading) {
        throw new Error('لم يتم العثور على نصوص واضحة أو تفاصيل إشعاعية مقروءة. تأكد من إضاءة ووضوح الصورة.');
      }

      setExtractedLabs(parsedLabs);

      const combinedRadiologyNotes = [
        visualRadiologyReading ? `🩻 القراءة البصرية للأشعة (Vision AI):\n${visualRadiologyReading}` : '',
        textRadiologySummary ? `📄 ملخص التقرير المكتوب:\n${textRadiologySummary}` : ''
      ].filter(Boolean).join('\n\n');

      if (combinedRadiologyNotes) {
        setExtractedRadiologyNotes(combinedRadiologyNotes);
      }

      // تغذية حاسبة DAS28 تلقائياً بقيم ESR أو CRP المستخرجة من الجدول إن وجدت
      const foundEsr = parsedLabs.find(r => /\besr\b|sedimentation|الترسيب/i.test(r.testName));
      if (foundEsr && foundEsr.value) {
        const num = String(foundEsr.value).replace(/[^0-9.]/g, '');
        if (num) setDasEsrInput(num);
      }
      const foundCrp = parsedLabs.find(r => /\bcrp\b|c-reactive|البروتين التفاعلي/i.test(r.testName));
      if (foundCrp && foundCrp.value) {
        const num = String(foundCrp.value).replace(/[^0-9.]/g, '');
        if (num) setDasCrpInput(num);
      }
    } catch (err) {
      setLabsExtractionError(err.message || 'تعذر استخراج البيانات تلقائياً، يمكنك إعادة المحاولة أو الإضافة يدوياً.');
    } finally {
      setExtractingLabsTable(false);
    }
  };
  // تشغيل استخراج الجدول تلقائياً عند إضافة أو تحديث صور التحاليل
  useEffect(() => {
    if (aiScanItems.length === 0) {
      lastExtractedSignatureRef.current = '';
      return;
    }
    const sig = aiScanItems.map(i => i.id).join('|');
    if (sig === lastExtractedSignatureRef.current) return;
    lastExtractedSignatureRef.current = sig;
    handleExtractStructuredLabsFromImages(aiScanItems);
  }, [aiScanItems]);

  // جلب نتيجة نفس التحليل من آخر زيارة سابقة مسجلة للمريض للمقارنة الجانبية
  const getPreviousLabValue = (testName) => {
    if (!testName || !Array.isArray(patientHistory) || patientHistory.length === 0) return null;
    const cleanTarget = testName.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
    if (!cleanTarget) return null;

    for (const rec of patientHistory) {
      let df = rec.dynamic_fields;
      if (typeof df === 'string') {
        try { df = JSON.parse(df); } catch (e) { df = {}; }
      }
      const prevList = df?.extractedLabs || df?.extracted_labs;
      if (Array.isArray(prevList) && prevList.length > 0) {
        const match = prevList.find(item => {
          const cleanPrev = (item.testName || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
          return cleanPrev && (cleanPrev === cleanTarget || cleanPrev.includes(cleanTarget) || cleanTarget.includes(cleanPrev));
        });
        if (match && match.value) {
          return {
            value: match.value,
            date: rec.visit_date || (rec.created_at ? rec.created_at.split('T')[0] : '')
          };
        }
      }
    }
    return null;
  };

  const handleUpdateExtractedLabCell = (rowId, field, newValue) => {
    setExtractedLabs(prev =>
      prev.map(row => (row.id === rowId ? { ...row, [field]: newValue } : row))
    );
  };

  const handleRemoveExtractedLabRow = (rowId) => {
    setExtractedLabs(prev => prev.filter(row => row.id !== rowId));
  };

  const handleAddManualRowToExtractedTable = () => {
    setExtractedLabs(prev => [
      ...prev,
      {
        id: `lab_manual_${Date.now()}`,
        testName: '',
        value: '',
        unit: '',
        referenceRange: '',
        status: 'Normal'
      }
    ]);
  };

  const compressImage = (file, maxWidth = 2400, quality = 0.92) => {
    return new Promise((resolve) => {
      try {
        if (!file || !file.type.includes('image')) return resolve(file);
        const objectUrl = URL.createObjectURL(file);
        const img = new window.Image();
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

  // --- معالجة وتحسين دقة وتباين صور التحاليل والأشعة للقراءة الدقيقة بالذكاء الاصطناعي ---
  const enhanceScanImageForAI = (file, maxWidth = 2800, quality = 0.95) => {
    return new Promise((resolve) => {
      try {
        const objectUrl = URL.createObjectURL(file);
        const img = new window.Image();
        img.src = objectUrl;
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // الحفاظ على الدقة الفائقة (حتى 2800px) وتكبير الصور الصغيرة قليلاً لوضوح الأرقام الطبية
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else if (width < 1400) {
            const scale = Math.min(1800 / width, 1.5);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // تحسين التباين والوضوح للنصوص والأرقام المطبوعة على أوراق التحاليل
          if (typeof ctx.filter !== 'undefined') {
            ctx.filter = 'contrast(1.18) brightness(1.04) saturate(1.05)';
          }
          ctx.drawImage(img, 0, 0, width, height);

          const base64DataUrl = canvas.toDataURL('image/jpeg', quality);
          canvas.toBlob(
            (blob) => {
              const finalBlob = blob || file;
              resolve({
                blob: finalBlob,
                previewUrl: base64DataUrl,
                base64: base64DataUrl
              });
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              blob: file,
              previewUrl: reader.result,
              base64: reader.result
            });
          };
          reader.readAsDataURL(file);
        };
      } catch (e) {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            blob: file,
            previewUrl: reader.result,
            base64: reader.result
          });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // --- التقاط أو رفع عدة صور للتحاليل والأشعة بدقة عالية + قفل الإدخال اليدوي تلقائياً ---
  const handleSelectMultipleAiScanImages = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setProcessingAiImages(true);
    try {
      const processedItems = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const enhanced = await enhanceScanImageForAI(file, 2800, 0.95);
        processedItems.push({
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`,
          blob: enhanced.blob,
          previewUrl: enhanced.base64 || enhanced.previewUrl,
          base64: enhanced.base64,
          title: file.name ? file.name.replace(/\.[^/.]+$/, '') : `تحليل / أشعة ${i + 1}`
        });
      }

      setAiScanItems(prev => {
        if (prev.length === 0) {
          setManualLabsUnlocked(false);
        }
        return [...prev, ...processedItems];
      });
    } catch (err) {
      showAlert('خطأ في معالجة الصور', err.message || 'تعذر تحسين دقة الصور المختارة.');
    } finally {
      setProcessingAiImages(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleRemoveAiScanItem = (id) => {
    setAiScanItems(prev => {
      const target = prev.find(item => item.id === id);
      if (target?.previewUrl) revokeBlobUrlSafely(target.previewUrl);
      const updated = prev.filter(item => item.id !== id);
      if (updated.length === 0) {
        setManualLabsUnlocked(false);
      }
      return updated;
    });
  };

  const handleClearAllAiScanItems = () => {
    aiScanItems.forEach(item => revokeBlobUrlSafely(item.previewUrl));
    setAiScanItems([]);
    setExtractedLabs([]);
    setExtractedRadiologyNotes('');
    setLabsExtractionError('');
    setManualLabsUnlocked(false);
  };

  // --- إرسال صورة (أو كل الصور) من أرشيف أشعة المريض إلى الذكاء الاصطناعي لقراءتها فوراً ---
  const prepareArchivedScanItem = async (scanObj, idx = 0) => {
    let base64Data = scanObj.url;
    if (scanObj.url.startsWith('http')) {
      try {
        const res = await fetch(scanObj.url, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        // استخدام الرابط المباشر كاحتياط
      }
    }
    return {
      id: `arch_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      blob: null,
      previewUrl: base64Data,
      base64: base64Data,
      remoteUrl: scanObj.url,
      title: scanObj.title || 'أشعة من أرشيف المريض'
    };
  };

  const handleSendArchivedScanToAI = async (scanObj) => {
    if (!scanObj || !scanObj.url) return;
    if (aiScanItems.some(item => item.remoteUrl === scanObj.url)) {
      showAlert('تنبيه', 'هذه الصورة مضافة بالفعل في قائمة قراءة الذكاء الاصطناعي.');
      return;
    }
    setProcessingAiImages(true);
    try {
      const preparedItem = await prepareArchivedScanItem(scanObj, 0);
      setAiScanItems(prev => {
        if (prev.some(item => item.remoteUrl === scanObj.url)) return prev;
        if (prev.length === 0) setManualLabsUnlocked(false);
        return [...prev, preparedItem];
      });
    } finally {
      setProcessingAiImages(false);
    }
  };

  const handleSendAllArchivedScansToAI = async () => {
    const newScans = patientScansGrid.filter(
      sc => sc?.url && !aiScanItems.some(item => item.remoteUrl === sc.url)
    );
    if (newScans.length === 0) {
      showAlert('تنبيه', 'جميع صور أرشيف المريض مضافة بالفعل في قائمة قراءة الذكاء الاصطناعي.');
      return;
    }
    setProcessingAiImages(true);
    try {
      const preparedBatch = [];
      for (let i = 0; i < newScans.length; i++) {
        const item = await prepareArchivedScanItem(newScans[i], i);
        preparedBatch.push(item);
      }
      setAiScanItems(prev => {
        if (prev.length === 0) setManualLabsUnlocked(false);
        return [...prev, ...preparedBatch];
      });
    } finally {
      setProcessingAiImages(false);
    }
  };

  // --- زر الحفظ المباشر لصور التحاليل والأشعة الملتقطة (من كاميرا اللابتوب أو الهاتف أو الجهاز) في سجل المريض ---
  const handleDirectSaveAiScansToPatient = async () => {
    if (!patientName.trim()) {
      showAlert('تنبيه هام', 'يرجى إدخال اسم المريض أولاً قبل حفظ الصور في سجله.');
      return;
    }
    if (aiScanItems.length === 0) {
      showAlert('تنبيه', 'لا توجد صور ملتقطة أو مرفوعة للحفظ.');
      return;
    }

    setSavingAiScansDirectly(true);
    try {
      const userEmail = session?.user?.email?.toLowerCase();
      const currentUserId = session?.user?.id;

      // 1. جلب أو إنشاء العيادة
      let clinicId = null;
      let cQuery = supabase.from('clinics').select('id');
      if (userEmail) cQuery = cQuery.ilike('email', userEmail);
      else if (currentUserId) cQuery = cQuery.eq('user_id', currentUserId);

      const { data: existingClinic } = await cQuery.limit(1).maybeSingle();
      if (existingClinic) {
        clinicId = existingClinic.id;
      } else {
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
        if (cErr) throw new Error('خطأ في بيانات العيادة: ' + cErr.message);
        clinicId = newClinic?.id;
      }

      // 2. جلب أو إنشاء المريض تلقائياً إذا كان مريضاً جديداً
      let patientRealId = currentPatientId;
      let patientRealCode = selectedPatientCode || ('PAT-' + Math.floor(10000 + Math.random() * 90000));

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
              patient_code: patientRealCode,
              clinic_id: clinicId,
              doctor_email: userEmail || null
            }])
            .select('id, patient_code')
            .single();

          if (pErr) throw new Error('خطأ في تسجيل المريض: ' + pErr.message);
          patientRealId = newPatient?.id;
          patientRealCode = newPatient?.patient_code || patientRealCode;
        }
      }

      setSelectedPatientCode(patientRealCode);
      setCurrentPatientId(patientRealId);

      // 3. رفع الصور إلى مجلد المريض في التخزين السحابي clinic-assets
      const savedScansList = [];
      for (let i = 0; i < aiScanItems.length; i++) {
        const item = aiScanItems[i];
        let publicUrl = '';

        if (item.blob) {
          const uniqueId = Math.random().toString(36).substring(2, 9);
          const filePath = `patient_scans/${patientRealCode}/${Date.now()}_${uniqueId}_${i}.jpg`;

          const { error: uploadErr } = await supabase.storage
            .from('clinic-assets')
            .upload(filePath, item.blob, { upsert: true });

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('clinic-assets').getPublicUrl(filePath);
            publicUrl =
              urlData?.publicUrl ||
              (urlData?.data ? urlData.data.publicUrl : null) ||
              `https://emynlqikbdwogijqfbfw.supabase.co/storage/v1/object/public/clinic-assets/${filePath}`;
          } else {
            publicUrl = item.remoteUrl || item.base64;
          }
        } else {
          publicUrl = item.remoteUrl || item.base64;
        }

        savedScansList.push({
          id: `${Date.now()}_${i}`,
          title: item.title || `تحليل / أشعة (${new Date().toLocaleDateString('ar-EG')})`,
          url: publicUrl,
          created_at: new Date().toISOString()
        });
      }

      // 4. حفظ الصور في سجل المريض medical_records
      const { error: recErr } = await supabase.from('medical_records').insert([{
        patient_id: patientRealId,
        clinic_id: clinicId,
        doctor_email: userEmail || null,
        visit_date: new Date().toISOString().split('T')[0],
        diagnosis: `مرفقات تحاليل وأشعة (${savedScansList.length} صورة)`,
        qr_verification_code: 'VERIFY-' + patientRealCode,
        dynamic_fields: { scans_list: savedScansList, extracted_labs: extractedLabs }
      }]);

      if (recErr) throw new Error('خطأ في حفظ الصور بالسجل الطبي: ' + recErr.message);

      showAlert(
        'تم الحفظ في سجل المريض ✅',
        `تم حفظ (${savedScansList.length}) صورة تحليل/أشعة مباشرة في سجل المريض [${patientName} - ${patientRealCode}]!\nالصور لا تزال متاحة في المعاينة إذا أردت تشغيل تحليل الذكاء الاصطناعي عليها.`
      );

      await fetchPatientScansByPatientId(patientRealId);
    } catch (err) {
      showAlert('خطأ في الحفظ المباشر ❌', err.message || 'تعذر حفظ الصور في سجل المريض.');
    } finally {
      setSavingAiScansDirectly(false);
    }
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
    setSelectedScanFiles(prev => {
      const target = prev.find(item => item.id === id);
      if (target?.previewUrl) revokeBlobUrlSafely(target.previewUrl);
      return prev.filter(item => item.id !== id);
    });
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
      selectedScanFiles.forEach(item => revokeBlobUrlSafely(item.previewUrl));
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
      const { error } = await supabase.storage
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
    setSelectedDiseaseNature(['Inflammatory (التهابي)', 'Arthritis (التهاب متورم)']);
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
    setDasEsrInput('52');
    setDasCrpInput('24');
    setRheumaAntiCCP('إيجابي مرتفع (+++) > 3x');
    setRheumaRF('إيجابي مرتفع (+++)');
    setRheumaEsrCrp('مرتفع جداً (High Active Flare)');
    handleSearchPatientByName(dummyName);
  };

  // --- نموذج الاستنتاج الطبي المعتمد على الجدول الظاهر وحساب DAS28 وخريطة المفاصل (يدعم أي عدد من الصور عبر النصوص المستخرجة) ---
  const handleClinicalAnalysis = async () => {
    if (!patientName.trim()) {
      showAlert('تنبيه', 'يرجى إدخال اسم المريض أولاً.');
      return;
    }

    if (extractingLabsTable) {
      showAlert('يرجى الانتظار', 'جاري استخراج نتائج التحاليل من الصور حالياً، انتظر ثوانٍ معدودة ثم اضغط تحليل.');
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

    // تجميع التحاليل اليدوية الأساسية المختارة فعلياً فقط
    const manualLabsSummary = [];
    if (rheumaEsrCrp) manualLabsSummary.push(`ESR / CRP: ${rheumaEsrCrp}`);
    if (rheumaRF) manualLabsSummary.push(`RF: ${rheumaRF}`);
    if (rheumaAntiCCP) manualLabsSummary.push(`Anti-CCP: ${rheumaAntiCCP}`);
    if (rheumaANA) manualLabsSummary.push(`ANA: ${rheumaANA}`);
    if (rheumaAntiDsDNA) manualLabsSummary.push(`Anti-dsDNA: ${rheumaAntiDsDNA}`);
    if (rheumaOrganSafety) manualLabsSummary.push(`Organ & Viral Safety: ${rheumaOrganSafety}`);

    // تجميع بيانات جدول التحاليل وتقرير الأشعة المستخرج والمراجع من الطبيب
    const structuredTableSummary = extractedLabs.length > 0
      ? extractedLabs
          .filter(r => r.testName.trim() || r.value.trim())
          .map(r => `- ${r.testName}: ${r.value} ${r.unit} (Ref: ${r.referenceRange || 'N/A'}) [${r.status}]`)
          .join('\n')
      : '';

    const queryNote = isQueryDiagnosis
      ? `NOTE: This is a PROVISIONAL / QUERY DIAGNOSIS (تشخيص مبدئي محتمل). Doctor's suspected provisional diagnosis: "${combinedProvisional || 'Unspecified'}". Evaluate this provisional suspicion against the clinical findings, suggest probable differential diagnoses, and recommend specific required laboratory tests/radiology to confirm.`
      : "";

    // تجميع ملخص آخر 3 زيارات سابقة للمريض (التشخيص، الأدوية السابقة، ودرجة نشاط DAS28 السابقة)
    const previousVisitsSummary = Array.isArray(patientHistory) && patientHistory.length > 0
      ? patientHistory.slice(0, 3).map((rec, idx) => {
          let df = rec.dynamic_fields;
          if (typeof df === 'string') {
            try { df = JSON.parse(df); } catch (e) { df = {}; }
          }
          const prevDas = df?.rheumaDetails?.diseaseActivity;
          const prevDasText = prevDas ? ` | ${prevDas.formula}: ${prevDas.score}` : '';
          const prevMeds = Array.isArray(rec.prescriptions) && rec.prescriptions.length > 0
            ? ` | Meds: ${rec.prescriptions.map(m => m.name).join(', ')}`
            : '';
          const vDate = rec.visit_date || (rec.created_at ? rec.created_at.split('T')[0] : '');
          return `Visit ${idx + 1} (${vDate}): Diagnosis="${rec.diagnosis || 'N/A'}"${prevDasText}${prevMeds}`;
        }).join('\n')
      : 'First recorded visit (No prior visit history)';

    const multiImageInstruction = aiScanItems.length > 0
      ? `\nIMPORTANT: The doctor has uploaded/scanned ${aiScanItems.length} lab/radiology image(s) which were OCR-extracted and verified in the structured lab table below. Integrate all abnormal lab values, DAS28 disease activity score, and radiology notes directly into your clinical assessment and warnings.`
      : "";

    const systemPrompt = `You are an expert AI Clinical Rheumatologist & Immunologist.
Analyze the rheumatology patient case based on ACR/EULAR criteria.
${queryNote}
${multiImageInstruction}

Respond ONLY with a valid JSON object without Markdown formatting:
{
  "diagnosis": "English Diagnosis - الشرح بالعربي",
  "warnings": ["تحذير إكلينيكي بالعربي عن الضغط، الكبد، الكلى، التعارضات والتحاليل المستخرجة"],
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
- Disease Nature: ${selectedDiseaseNature.join(', ') || 'None'}
- Systemic & Extra-articular Signs: ${systemicSignsNames.join(', ') || 'None'}

-- Clinical Joint Map (O/E) & Disease Activity --
- INFLAMMED/SWOLLEN JOINTS (Red): ${inflamedJointsList.join(', ') || 'None'}
- PAINFUL JOINTS ONLY (Blue): ${painfulJointsList.join(', ') || 'None'}
- Calculated Disease Activity (${rheumaActivityResult.formula}): ${rheumaActivityResult.score} -> ${rheumaActivityResult.level} (Swollen: ${rheumaActivityResult.swollenCount}, Total Tender: ${rheumaActivityResult.tenderCount})

-- Physical & Clinical Tests --
- Physical Examination Findings: ${clinicalTestsNames.join(', ') || 'None'}

-- Verified Extracted Lab Table (Doctor-Reviewed OCR Results from ${aiScanItems.length} Scanned Document(s)) --
${structuredTableSummary || 'No structured lab table rows extracted'}
${extractedRadiologyNotes ? `\n-- Extracted Radiology Notes --\n${extractedRadiologyNotes}` : ''}

-- Core Serology & Safety Quick Chips --
${manualLabsSummary.length > 0 ? manualLabsSummary.map(l => `- ${l}`).join('\n') : '- None selected'}

-- Previous Visits & Treatment History (For Disease Progression & Treatment Response) --
${previousVisitsSummary}

${isQueryDiagnosis ? `Doctor's Provisional / Query Diagnosis: ${combinedProvisional || 'Suspected autoimmune/rheumatic condition'}` : ''}
Additional Doctor Notes & Symptoms: ${symptomsInput || 'None'} | ${doctorNotes || ''}`;

    try {
      const requestBody = {
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: promptText }
        ],
        temperature: 0.2
      };

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

      // --- رفع صور التحاليل والأشعة الملتقطة تلقائياً إلى ملف المريض السحابي ---
      const autoUploadedScansList = [];
      if (aiScanItems.length > 0 && patientRealCode) {
        for (let i = 0; i < aiScanItems.length; i++) {
          const item = aiScanItems[i];
          let publicUrl = '';

          if (item.blob) {
            const uniqueId = Math.random().toString(36).substring(2, 9);
            const filePath = `patient_scans/${patientRealCode}/${Date.now()}_${uniqueId}_${i}.jpg`;

            const { error: uploadErr } = await supabase.storage
              .from('clinic-assets')
              .upload(filePath, item.blob, { upsert: true });

            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from('clinic-assets').getPublicUrl(filePath);
              publicUrl = urlData?.publicUrl || (urlData?.data ? urlData.data.publicUrl : null) || `https://emynlqikbdwogijqfbfw.supabase.co/storage/v1/object/public/clinic-assets/${filePath}`;
            } else {
              publicUrl = item.remoteUrl || item.base64;
            }
          } else {
            publicUrl = item.remoteUrl || item.base64;
          }

          autoUploadedScansList.push({
            id: `${Date.now()}_${i}`,
            title: item.title || `تحليل / أشعة (${new Date().toLocaleDateString('ar-EG')})`,
            url: publicUrl,
            created_at: new Date().toISOString()
          });
        }
      }

      if (patientRealId) {
        const dynamicPayload = { 
          age, 
          gender, 
          chronicDiseases, 
          familyHistory: familyHistoryText, 
          symptoms: symptomsInput,
          extractedLabs: extractedLabs.length > 0 ? extractedLabs : null,
          extractedRadiologyNotes: extractedRadiologyNotes || null,
          rheumaDetails: isRheumaSpecialty ? {
            stiffnessType,
            stiffnessDuration,
            provisionalDiagnosis: isQueryDiagnosis ? combinedProvisional : null,
            jointStates: selectedJointStates,
            diseaseActivity: rheumaActivityResult,
            esrCrp: rheumaEsrCrp || null,
            antiCCP: rheumaAntiCCP || null,
            rf: rheumaRF || null,
            ana: rheumaANA || null,
            antiDsDNA: rheumaAntiDsDNA || null,
            organSafety: rheumaOrganSafety || null
          } : null
        };

        if (autoUploadedScansList.length > 0) {
          dynamicPayload.scans_list = autoUploadedScansList;
        }

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
            dynamic_fields: dynamicPayload
          }]);

        if (recErr) throw new Error('خطأ في حفظ السجل الطبي: ' + recErr.message);
      }

      const savedScansNote = autoUploadedScansList.length > 0
        ? `\nتم حفظ (${autoUploadedScansList.length}) صورة تحليل/أشعة تلقائياً في ملف المريض.`
        : '';

      // تفريغ صور التحاليل المؤقتة وتنظيف الذاكرة بعد حفظها في السحابة
      if (aiScanItems.length > 0) {
        aiScanItems.forEach(item => revokeBlobUrlSafely(item.previewUrl));
        setAiScanItems([]);
        setManualLabsUnlocked(false);
      }

      showAlert("نجاح الحفظ السحابي ✅", `تم حفظ التقرير والسجل الطبي بنجاح!\nكود المريض: [${patientRealCode}]${savedScansNote}`);

      await generatePrescriptionPDF(
        { name: patientName, phone: patientPhone, code: patientRealCode },
        finalDiagnosis,
        {
          'السن والنوع': `${age || 'غير محدد'} سنة (${gender})`,
          'الأمراض المزمنة': chronicDiseases || 'لا يوجد',
          'ملاحظات التشخيص': isQueryDiagnosis
            ? `تشخيص محتمل (${combinedProvisional || 'Query Diagnosis'}) - يحتاج متابعة`
            : 'فحص معتمد',
          ...(includeLabsInPdf && extractedLabs.length > 0
            ? {
                'ملخص التحاليل': extractedLabs
                  .filter(r => r.testName && r.value)
                  .map(r => `${r.testName}: ${r.value} ${r.unit || ''} (${r.status})`)
                  .join(' | ')
              }
            : {})
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
      {/* Live Desktop/USB Camera Modal */}
      <Modal visible={showLiveCameraModal} transparent animationType="fade">
        <View style={styles.bridgeModalOverlay}>
          <View style={styles.bridgeModalCard}>
            <View style={styles.bridgeModalHeader}>
              <Text style={styles.bridgeModalTitle}>📸 الكاميرا الحية (لابتوب / كاميرا USB منفصلة)</Text>
              <TouchableOpacity style={styles.bridgeCloseBtn} onPress={handleCloseLiveCameraModal}>
                <Text style={styles.bridgeCloseBtnText}>إغلاق ✕</Text>
              </TouchableOpacity>
            </View>

            {Platform.OS === 'web' && cameraDevices.length > 0 && (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.label}>اختر مصدر الكاميرا (المدمجة أو كاميرا USB خارجية):</Text>
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleSwitchCameraDevice(e.target.value)}
                  style={styles.cameraSelectDropdown}
                >
                  {cameraDevices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `كاميرا متصلة #${idx + 1}`}
                    </option>
                  ))}
                </select>
              </View>
            )}

            <View style={styles.liveVideoFrame}>
              {cameraStarting && (
                <View style={styles.cameraOverlayMsg}>
                  <ActivityIndicator size="large" color="#00F2FE" />
                  <Text style={{ color: '#00F2FE', fontSize: 12, marginTop: 8, fontWeight: 'bold' }}>
                    جاري تشغيل الكاميرا بأعلى دقة...
                  </Text>
                </View>
              )}
              {cameraError ? (
                <View style={styles.cameraOverlayMsg}>
                  <Text style={{ color: '#FCA5A5', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                    ⚠️ {cameraError}
                  </Text>
                  <TouchableOpacity
                    style={[styles.bridgePrimaryBtn, { marginTop: 12 }]}
                    onPress={() => startLiveCameraStream(selectedCameraId)}
                  >
                    <Text style={styles.bridgeBtnText}>🔄 إعادة محاولة تشغيل الكاميرا</Text>
                  </TouchableOpacity>
                </View>
              ) : Platform.OS === 'web' ? (
                <video
                  ref={liveVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '300px', objectFit: 'contain', backgroundColor: '#000', borderRadius: '10px' }}
                />
              ) : null}
            </View>

            <View style={styles.bridgeActionRow}>
              <TouchableOpacity
                style={[styles.bridgeCaptureBtn, (cameraStarting || !!cameraError || processingAiImages) && { opacity: 0.5 }]}
                onPress={handleCaptureFromLiveCamera}
                disabled={cameraStarting || !!cameraError || processingAiImages}
              >
                {processingAiImages ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.bridgeBtnText}>📸 التقاط الصورة وإضافتها للمعاينة ({aiScanItems.length})</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.bridgeDoneBtn} onPress={handleCloseLiveCameraModal}>
                <Text style={styles.bridgeBtnText}>✅ تم الانتهاء</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.bridgeHintText}>
              💡 يمكنك التقاط عدة أوراق متتالية؛ كل لقطة تُحسّن دقتها فوراً وتُضاف لشبكة المعاينة مع استخراج جدول التحاليل تلقائياً.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Mobile QR Camera Bridge Modal */}
      <Modal visible={showQrBridgeModal} transparent animationType="fade">
        <View style={styles.bridgeModalOverlay}>
          <View style={styles.bridgeModalCard}>
            <View style={styles.bridgeModalHeader}>
              <Text style={styles.bridgeModalTitle}>📱 ربط كاميرا الهاتف الذكي عبر QR Code</Text>
              <TouchableOpacity style={styles.bridgeCloseBtn} onPress={handleCloseQrBridgeModal}>
                <Text style={styles.bridgeCloseBtnText}>إنهاء وإغلاق ✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.bridgeSubText}>
              امسح الرمز التالي بكاميرا هاتفك لفتح الماسح الضوئي السريع؛ أي صورة أو دفعة صور تلتقطها وترسلها بهاتفك ستظهر فوراً في لوحة الكشف الحالية:
            </Text>

            <View style={styles.qrBoxContainer}>
              {qrCodeImageUrl ? (
                Platform.OS === 'web' ? (
                  <img
                    src={qrCodeImageUrl}
                    alt="QR Code"
                    style={{ width: '210px', height: '210px', borderRadius: '10px', backgroundColor: '#FFFFFF', padding: '6px' }}
                  />
                ) : (
                  <Image source={{ uri: qrCodeImageUrl }} style={{ width: 210, height: 210, borderRadius: 10 }} />
                )
              ) : null}
              <Text style={styles.qrSessionTag}>كود الجلسة الحية: {qrBridgeSessionId}</Text>
            </View>

            <View style={styles.qrStatusBanner}>
              <Text style={styles.qrStatusBannerText}>{qrSyncStatus}</Text>
              {qrReceivedCount > 0 && (
                <Text style={styles.qrCounterBadge}>📥 إجمالي الصور المستلمة من الهاتف: {qrReceivedCount}</Text>
              )}
            </View>

            <TouchableOpacity style={styles.bridgeDoneBtn} onPress={handleCloseQrBridgeModal}>
              <Text style={styles.bridgeBtnText}>✅ إغلاق النافذة ومتابعة التحليل ({aiScanItems.length} صورة جاهزة)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              {Platform.OS === 'web' ? (
                <img
                  src={viewingImageModal.url}
                  alt={viewingImageModal.title}
                  style={{ width: `${340 * zoomScale}px`, height: `${340 * zoomScale}px`, objectFit: 'contain', borderRadius: '8px' }}
                />
              ) : (
                <Image 
                  source={{ uri: viewingImageModal.url }} 
                  style={{ width: 340 * zoomScale, height: 340 * zoomScale, borderRadius: 8 }} 
                  resizeMode="contain"
                />
              )}
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

            <ClinicalHint text="ابحث باسم المريض لاستدعاء زياراته السابقة وأشعاته تلقائياً، أو أدخل اسماً جديداً لتوليد كود طبي خاص به." />

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
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>🖼️ شبكة أشعة ومرفقات المريض (Grid View)</Text>
                  {patientScansGrid.length > 0 && (
                    <TouchableOpacity
                      style={styles.reExtractBtn}
                      onPress={handleSendAllArchivedScansToAI}
                      disabled={processingAiImages}
                    >
                      <Text style={styles.reExtractBtnText}>🧠 قراءة كل الأرشيف بالـ AI</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
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
                          style={[styles.zoomMiniBtn, { width: '100%', alignItems: 'center', marginTop: 4 }]} 
                          onPress={() => handleSendArchivedScanToAI(sc)}
                        >
                          <Text style={styles.zoomMiniBtnText}>🧠 قراءة بالـ AI</Text>
                        </TouchableOpacity>
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

          {/* الكارت الذكي 1: التقاط ورفع صور التحاليل والأشعة */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>📷 1. تصوير ورفع التحاليل والأشعة (AI Vision OCR)</Text>
              {hasAiScanImages && (
                <TouchableOpacity onPress={handleClearAllAiScanItems} style={styles.deleteScanBtn}>
                  <Text style={styles.deleteScanBtnText}>🗑️ مسح الكل ({aiScanItems.length})</Text>
                </TouchableOpacity>
              )}
            </View>

            <ClinicalHint text="الخطوة الأولى: صوّر أوراق التحاليل والأشعة بالموبايل (QR) أو بكاميرا اللابتوب أو ارفعها من جهازك (بأي عدد من الصور)؛ سيقوم الذكاء الاصطناعي بقراءتها وتحويلها لجدول أرقام منظم يظهر أمامك مباشرة." />

            {Platform.OS === 'web' ? (
              <View style={styles.aiUploadButtonsRow}>
                <label style={styles.aiFilePickerLabel}>
                  📁 اختيار صور من الجهاز (متعدد)
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleSelectMultipleAiScanImages}
                    style={{ display: 'none' }}
                  />
                </label>

                <TouchableOpacity
                  style={styles.aiLiveCamBtn}
                  onPress={handleOpenLiveCameraModal}
                >
                  <Text style={styles.aiActionBtnText}>📸 الكاميرا الحية (لابتوب / USB)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.aiQrBridgeBtn}
                  onPress={handleOpenQrBridgeModal}
                >
                  <Text style={styles.aiActionBtnText}>📱 ربط كاميرا الهاتف (QR)</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {processingAiImages && (
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginVertical: 10 }}>
                <ActivityIndicator color="#00F2FE" size="small" />
                <Text style={{ color: '#00F2FE', fontSize: 12, fontWeight: 'bold' }}>
                  جاري رفع دقة الصور وتحسين التباين لقراءة الأرقام بدقة فائقة...
                </Text>
              </View>
            )}

            {hasAiScanImages && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.selectedCodeBadge}>
                  ✅ تم تجهيز ({aiScanItems.length}) صورة بدقة عالية للقراءة بالـ AI والحفظ المباشر في ملف المريض:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {aiScanItems.map((item, index) => {
                    const displaySrc = item.base64 || item.previewUrl || item.remoteUrl;
                    return (
                      <View key={item.id} style={styles.scanPreviewCard}>
                        <TouchableOpacity
                          onPress={() => {
                            setViewingImageModal({ url: displaySrc, title: item.title || `صورة ${index + 1}` });
                            setZoomScale(1);
                          }}
                        >
                          {Platform.OS === 'web' ? (
                            <img
                              src={displaySrc}
                              alt={item.title}
                              style={{ width: '115px', height: '115px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #0284C7' }}
                            />
                          ) : (
                            <Image source={{ uri: displaySrc }} style={styles.scanPreviewImg} />
                          )}
                        </TouchableOpacity>
                        <Text style={styles.scanGridTitle} numberOfLines={1}>{item.title || `صورة ${index + 1}`}</Text>
                        <View style={{ flexDirection: 'row-reverse', gap: 4, marginTop: 4 }}>
                          <TouchableOpacity
                            style={styles.zoomMiniBtn}
                            onPress={() => {
                              setViewingImageModal({ url: displaySrc, title: item.title || `صورة ${index + 1}` });
                              setZoomScale(1);
                            }}
                          >
                            <Text style={styles.zoomMiniBtnText}>🔍 معاينة</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteScanBtn}
                            onPress={() => handleRemoveAiScanItem(item.id)}
                          >
                            <Text style={styles.deleteScanBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.directSaveScansBtn, savingAiScansDirectly && { opacity: 0.6 }]}
                  onPress={handleDirectSaveAiScansToPatient}
                  disabled={savingAiScansDirectly}
                >
                  {savingAiScansDirectly ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.directSaveScansBtnText}>
                      💾 حفظ الصور مباشرة في سجل المريض ({aiScanItems.length} صورة)
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* الكارت الذكي 2: جدول التحاليل وتقرير الأشعة المستخرج من الصور */}
          {(hasAiScanImages || extractedLabs.length > 0 || Boolean(extractedRadiologyNotes) || extractingLabsTable) && (
            <View style={[styles.card, { borderColor: '#0284C7' }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionTitle}>📊 2. جدول التحاليل والأشعة المستخرج من الصور (AI Table)</Text>
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 }}>
                  {patientHistory.length > 0 && extractedLabs.length > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.reExtractBtn,
                        showPrevLabsComparison && { backgroundColor: '#0284C7', borderColor: '#00F2FE' }
                      ]}
                      onPress={() => setShowPrevLabsComparison(prev => !prev)}
                    >
                      <Text style={[styles.reExtractBtnText, showPrevLabsComparison && { color: '#FFFFFF' }]}>
                        {showPrevLabsComparison ? '✓ إخفاء المقارنة السابقة' : '📈 مقارنة بالزيارة السابقة'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {extractedLabs.length > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.reExtractBtn,
                        includeLabsInPdf && { backgroundColor: '#047857', borderColor: '#10B981' }
                      ]}
                      onPress={() => setIncludeLabsInPdf(prev => !prev)}
                    >
                      <Text style={[styles.reExtractBtnText, includeLabsInPdf && { color: '#FFFFFF' }]}>
                        {includeLabsInPdf ? '✓ مُدرج في الطباعة PDF' : '🖨️ إرفاق بالروشتة PDF'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {hasAiScanImages && (
                    <TouchableOpacity
                      style={styles.reExtractBtn}
                      onPress={() => handleExtractStructuredLabsFromImages(aiScanItems)}
                      disabled={extractingLabsTable}
                    >
                      <Text style={styles.reExtractBtnText}>
                        {extractingLabsTable ? 'جاري القراءة...' : '🔄 إعادة استخراج الجدول'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <ClinicalHint text="هذا الجدول يعرض كل القيم التي قرأها الذكاء الاصطناعي من الصور بوضوح أمامك. يمكنك تعديل أي رقم مباشرة بلمسة واحدة، وسيعتمد نموذج التشخيص النهائي على هذه القيم الظاهرة هنا." />

              {extractingLabsTable && (
                <View style={styles.extractingBanner}>
                  <ActivityIndicator color="#00F2FE" size="small" />
                  <Text style={styles.extractingBannerText}>
                    جاري قراءة ({aiScanItems.length}) صورة وتنظيم القيم في الجدول الطبي...
                  </Text>
                </View>
              )}

              {labsExtractionError ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>⚠️ {labsExtractionError}</Text>
                </View>
              ) : null}

              {extractedLabs.length > 0 && (
                <View style={styles.labTableContainer}>
                  <View style={styles.labTableHeaderRow}>
                    <Text style={[styles.labTableHeaderCell, { flex: 1.5 }]}>التحليل (Test)</Text>
                    <Text style={[styles.labTableHeaderCell, { flex: 1 }]}>القيمة</Text>
                    <Text style={[styles.labTableHeaderCell, { flex: 0.9 }]}>الوحدة</Text>
                    <Text style={[styles.labTableHeaderCell, { flex: 1.1 }]}>الطبيعي</Text>
                    <Text style={[styles.labTableHeaderCell, { flex: 0.9 }]}>الحالة</Text>
                    {showPrevLabsComparison && (
                      <Text style={[styles.labTableHeaderCell, { flex: 1.1 }]}>الزيارة السابقة</Text>
                    )}
                    <Text style={[styles.labTableHeaderCell, { width: 28 }]}>✕</Text>
                  </View>

                  {extractedLabs.map((row) => {
                    const isHigh = /high|positive|\+/i.test(row.status);
                    const isLow = /low/i.test(row.status);
                    const rowBg = isHigh
                      ? 'rgba(239, 68, 68, 0.14)'
                      : isLow
                      ? 'rgba(245, 158, 11, 0.14)'
                      : 'rgba(16, 185, 129, 0.08)';
                    const statusColor = isHigh ? '#FCA5A5' : isLow ? '#FDE047' : '#6EE7B7';

                    return (
                      <View key={row.id} style={[styles.labTableRow, { backgroundColor: rowBg }]}>
                        <TextInput
                          style={[styles.labCellInput, { flex: 1.5, fontWeight: 'bold', color: '#F8FAFC' }]}
                          value={row.testName}
                          onChangeText={(val) => handleUpdateExtractedLabCell(row.id, 'testName', val)}
                        />
                        <TextInput
                          style={[styles.labCellInput, { flex: 1, fontWeight: 'bold', color: statusColor }]}
                          value={row.value}
                          onChangeText={(val) => handleUpdateExtractedLabCell(row.id, 'value', val)}
                        />
                        <TextInput
                          style={[styles.labCellInput, { flex: 0.9, color: '#94A3B8' }]}
                          value={row.unit}
                          onChangeText={(val) => handleUpdateExtractedLabCell(row.id, 'unit', val)}
                        />
                        <TextInput
                          style={[styles.labCellInput, { flex: 1.1, color: '#94A3B8' }]}
                          value={row.referenceRange}
                          onChangeText={(val) => handleUpdateExtractedLabCell(row.id, 'referenceRange', val)}
                        />
                        <TextInput
                          style={[styles.labCellInput, { flex: 0.9, color: statusColor, fontWeight: 'bold' }]}
                          value={row.status}
                          onChangeText={(val) => handleUpdateExtractedLabCell(row.id, 'status', val)}
                        />
                        {showPrevLabsComparison && (() => {
                          const prevData = getPreviousLabValue(row.testName);
                          if (!prevData) {
                            return (
                              <Text style={[styles.labCellInput, { flex: 1.1, color: '#64748B', fontSize: 10 }]}>
                                أول مرة
                              </Text>
                            );
                          }
                          const currNum = parseFloat(String(row.value).replace(/[^0-9.]/g, ''));
                          const prevNum = parseFloat(String(prevData.value).replace(/[^0-9.]/g, ''));
                          let trendIcon = '';
                          if (!isNaN(currNum) && !isNaN(prevNum)) {
                            if (currNum < prevNum) trendIcon = ' 📉';
                            else if (currNum > prevNum) trendIcon = ' 📈';
                            else trendIcon = ' ➖';
                          }
                          return (
                            <Text style={[styles.labCellInput, { flex: 1.1, color: '#38BDF8', fontSize: 10 }]}>
                              {prevData.value}{trendIcon}
                            </Text>
                          );
                        })()}
                        <TouchableOpacity
                          style={styles.labRowDeleteBtn}
                          onPress={() => handleRemoveExtractedLabRow(row.id)}
                        >
                          <Text style={styles.labRowDeleteText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={styles.addLabRowBtn} onPress={handleAddManualRowToExtractedTable}>
                <Text style={styles.addLabRowBtnText}>➕ إضافة صف تحليل يدوياً للجدول</Text>
              </TouchableOpacity>

              {extractedRadiologyNotes ? (
                <View style={styles.radiologySummaryBox}>
                  <Text style={styles.radiologySummaryTitle}>🩻 ملخص تقارير الأشعة المستخرج:</Text>
                  <TextInput
                    style={styles.radiologySummaryInput}
                    multiline
                    value={extractedRadiologyNotes}
                    onChangeText={setExtractedRadiologyNotes}
                  />
                </View>
              ) : null}
            </View>
          )}

          {/* اختصاص الروماتيزم والمناعة */}
          {isRheumaSpecialty && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>📋 3. التاريخ المرضي والفحص الإكلينيكي للروماتيزم والمناعة</Text>

              <ClinicalHint text="تحديد التيبس الصباحي والأعراض الجهازية وخريطة المفاصل يُغذّي حاسبة نشاط المرض (DAS28) ويساعد الذكاء الاصطناعي في تطبيق معايير ACR/EULAR بدقة." />

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

              <Text style={styles.subSectionTitle}>⚠️ الأعراض والشكاوى الجهازية خارج المفصل (Systemic Checklist):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.systemicChecklist.map((item) => (
                  <TouchableOpacity key={item.id} style={[styles.selectChip, selectedSystemicSigns.includes(item.id) && styles.selectChipActiveMulti]} onPress={() => toggleMultiSelect(item.id, selectedSystemicSigns, setSelectedSystemicSigns)}>
                    <Text style={[styles.selectChipText, selectedSystemicSigns.includes(item.id) && styles.selectChipTextActive]}>{selectedSystemicSigns.includes(item.id) ? '✓ ' : ''}{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.subSectionTitle}>👨‍👩‍👧‍👦 التاريخ العائلي والدوائي الخاص (Family History):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.familyHistoryChecklist.map((item) => (
                  <TouchableOpacity key={item.id} style={[styles.selectChip, selectedFamilySigns.includes(item.id) && styles.selectChipActiveMulti]} onPress={() => toggleMultiSelect(item.id, selectedFamilySigns, setSelectedFamilySigns)}>
                    <Text style={[styles.selectChipText, selectedFamilySigns.includes(item.id) && styles.selectChipTextActive]}>{selectedFamilySigns.includes(item.id) ? '✓ ' : ''}{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.subSectionTitle}>🦴 ثانياً: خريطة استمارة العيادة لمفاصل الجسم (O/E Skeleton Map):</Text>
              <Text style={styles.label}>اختر نوع التحديد بالضغط أولاً، ثم انقر المفاصل على الرسمة (اضغط اليد أو القدم لتفصيل الأصابع):</Text>
              
              <View style={styles.jointModeSelectorRow}>
                <TouchableOpacity 
                  style={[styles.jointModeBtn, styles.jointModeBtnRed, jointSelectMode === 'inflamed' && styles.jointModeBtnActiveRed]} 
                  onPress={() => setJointSelectMode('inflamed')}
                >
                  <Text style={styles.jointModeBtnText}>🔴 مفصل ملتهب / متورم (Swollen)</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.jointModeBtn, styles.jointModeBtnBlue, jointSelectMode === 'painful' && styles.jointModeBtnActiveBlue]} 
                  onPress={() => setJointSelectMode('painful')}
                >
                  <Text style={styles.jointModeBtnText}>🔵 مفصل مؤلم فقط (Tender)</Text>
                </TouchableOpacity>
              </View>

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

              {/* حاسبة نشاط المرض التلقائية (Auto DAS28 / CDAI) */}
              <View style={styles.dasCalculatorBox}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.dasTitle}>📈 حاسبة نشاط المرض التلقائية (Auto DAS28 / CDAI)</Text>
                  <View style={[styles.dasBadge, { borderColor: rheumaActivityResult.color }]}>
                    <Text style={[styles.dasBadgeText, { color: rheumaActivityResult.color }]}>
                      {rheumaActivityResult.formula}: {rheumaActivityResult.score}
                    </Text>
                  </View>
                </View>

                <ClinicalHint text="تُحسب درجة نشاط الروماتويد تلقائياً بربط المفاصل الفريدة من الخريطة مع قيمة ESR أو CRP المستخرجة من الجدول (المفصل المتورم يُحسب ضمن المؤلمة تلقائياً وفق معايير DAS28)." />

                <View style={styles.dasCountsRow}>
                  <Text style={styles.dasCountPill}>🔴 المتورمة (Swollen): {inflamedCountDisplay}</Text>
                  <Text style={styles.dasCountPill}>🔵 المؤلمة فقط: {tenderOnlyCountDisplay} (الإجمالي TJC: {rheumaActivityResult.tenderCount})</Text>
                </View>

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={styles.label}>ESR (mm/hr)</Text>
                    <TextInput
                      style={[styles.input, { marginBottom: 6, padding: 8 }]}
                      placeholder="تلقائي من الجدول"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={dasEsrInput}
                      onChangeText={setDasEsrInput}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={styles.label}>CRP (mg/L)</Text>
                    <TextInput
                      style={[styles.input, { marginBottom: 6, padding: 8 }]}
                      placeholder="تلقائي من الجدول"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={dasCrpInput}
                      onChangeText={setDasCrpInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>تقييم المريض VAS (0-100)</Text>
                    <TextInput
                      style={[styles.input, { marginBottom: 6, padding: 8 }]}
                      placeholder="40"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={dasVasInput}
                      onChangeText={setDasVasInput}
                    />
                  </View>
                </View>

                <View style={[styles.dasResultBanner, { borderColor: rheumaActivityResult.color }]}>
                  <Text style={[styles.dasResultText, { color: rheumaActivityResult.color }]}>
                    النتيجة ({rheumaActivityResult.formula}): {rheumaActivityResult.score} — {rheumaActivityResult.level}
                  </Text>
                </View>
              </View>

              <Text style={styles.subSectionTitle}>🔍 الفحص الفيزيائي المباشر (O/E Specific Tests):</Text>
              <View style={styles.chipsContainer}>
                {RHEUMA_OPTIONS.clinicalTests.map((t) => (
                  <TouchableOpacity key={t.id} style={[styles.selectChip, selectedClinicalTests.includes(t.id) && styles.selectChipActiveMulti]} onPress={() => toggleMultiSelect(t.id, selectedClinicalTests, setSelectedClinicalTests)}>
                    <Text style={[styles.selectChipText, selectedClinicalTests.includes(t.id) && styles.selectChipTextActive]}>{selectedClinicalTests.includes(t.id) ? '✓ ' : ''}{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.labsSectionHeader}>
                <Text style={styles.subSectionTitle}>🔬 ثالثاً: التحاليل الأساسية المبسطة (Core Serology & Safety):</Text>
                <ClinicalHint text="تم تبسيط هذه القائمة لتشمل التحاليل الأساسية المرتبة فقط (ESR/CRP، RF/Anti-CCP، ANA/Anti-dsDNA، ووظائف الكلى والكبد والفيروسات) كخيار سريع عند عدم وجود صور." />
                {hasAiScanImages && (
                  <TouchableOpacity
                    style={[styles.manualLockToggleBtn, manualLabsUnlocked ? styles.manualLockToggleBtnOpen : styles.manualLockToggleBtnLocked]}
                    onPress={() => setManualLabsUnlocked(prev => !prev)}
                  >
                    <Text style={styles.manualLockToggleBtnText}>
                      {manualLabsUnlocked
                        ? '🔒 إغلاق الإدخال اليدوي والاعتماد على جدول الصور'
                        : '🔓 فتح الإدخال اليدوي السريع (بجانب جدول الصور)'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {isManualLabsLocked ? (
                <View style={styles.lockedLabsBanner}>
                  <Text style={styles.lockedLabsTitle}>
                    🔒 الإدخال اليدوي مغلق تلقائياً للاعتماد على جدول الصور المستخرج بالأعلى
                  </Text>
                  <Text style={styles.lockedLabsSub}>
                    تم التقاط/رفع ({aiScanItems.length}) صورة واستخراج قيمها في الجدول المنظم بالأعلى. إذا أردت إضافة تصنيف يدوي سريع اضغط على زر "🔓 فتح الإدخال اليدوي" بالأعلى.
                  </Text>
                </View>
              ) : (
                <View style={styles.labsWrapperBox}>
                  <Text style={styles.label}>1. سرعة الترسيب والبروتين الالتهابي (ESR / CRP):</Text>
                  <View style={styles.chipsContainer}>
                    {RHEUMA_OPTIONS.esrCrp.map((opt, i) => (
                      <TouchableOpacity key={i} style={[styles.selectChip, rheumaEsrCrp === opt && styles.selectChipActive]} onPress={() => toggleSingleChip(opt, rheumaEsrCrp, setRheumaEsrCrp)}>
                        <Text style={[styles.selectChipText, rheumaEsrCrp === opt && styles.selectChipTextActive]}>{rheumaEsrCrp === opt ? '✓ ' : ''}{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>2. Rheumatoid Factor (RF):</Text>
                  <View style={styles.chipsContainer}>
                    {RHEUMA_OPTIONS.rf.map((opt, i) => (
                      <TouchableOpacity key={i} style={[styles.selectChip, rheumaRF === opt && styles.selectChipActive]} onPress={() => toggleSingleChip(opt, rheumaRF, setRheumaRF)}>
                        <Text style={[styles.selectChipText, rheumaRF === opt && styles.selectChipTextActive]}>{rheumaRF === opt ? '✓ ' : ''}{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>3. Anti-CCP:</Text>
                  <View style={styles.chipsContainer}>
                    {RHEUMA_OPTIONS.antiCCP.map((opt, i) => (
                      <TouchableOpacity key={i} style={[styles.selectChip, rheumaAntiCCP === opt && styles.selectChipActive]} onPress={() => toggleSingleChip(opt, rheumaAntiCCP, setRheumaAntiCCP)}>
                        <Text style={[styles.selectChipText, rheumaAntiCCP === opt && styles.selectChipTextActive]}>{rheumaAntiCCP === opt ? '✓ ' : ''}{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>4. الأجسام المضادة للنوية (ANA):</Text>
                  <View style={styles.chipsContainer}>
                    {RHEUMA_OPTIONS.ana.map((opt, i) => (
                      <TouchableOpacity key={i} style={[styles.selectChip, rheumaANA === opt && styles.selectChipActive]} onPress={() => toggleSingleChip(opt, rheumaANA, setRheumaANA)}>
                        <Text style={[styles.selectChipText, rheumaANA === opt && styles.selectChipTextActive]}>{rheumaANA === opt ? '✓ ' : ''}{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>5. أضداد الذئبة (Anti-dsDNA):</Text>
                  <View style={styles.chipsContainer}>
                    {RHEUMA_OPTIONS.antiDsDNA.map((opt, i) => (
                      <TouchableOpacity key={i} style={[styles.selectChip, rheumaAntiDsDNA === opt && styles.selectChipActive]} onPress={() => toggleSingleChip(opt, rheumaAntiDsDNA, setRheumaAntiDsDNA)}>
                        <Text style={[styles.selectChipText, rheumaAntiDsDNA === opt && styles.selectChipTextActive]}>{rheumaAntiDsDNA === opt ? '✓ ' : ''}{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>6. وظائف الكلى والكبد وفيروسات الكبد (Organ & Viral Safety):</Text>
                  <View style={styles.chipsContainer}>
                    {RHEUMA_OPTIONS.organAndViralSafety.map((opt, i) => (
                      <TouchableOpacity key={i} style={[styles.selectChip, rheumaOrganSafety === opt && styles.selectChipActive]} onPress={() => toggleSingleChip(opt, rheumaOrganSafety, setRheumaOrganSafety)}>
                        <Text style={[styles.selectChipText, rheumaOrganSafety === opt && styles.selectChipTextActive]}>{rheumaOrganSafety === opt ? '✓ ' : ''}{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

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

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🩺 4. التحليل الإكلينيكي الشامل واقتراح الروشتة (Clinical Reasoning)</Text>

            <ClinicalHint text="يقرأ نموذج الاستنتاج الطبي البيانات الظاهرة في جدول التحاليل بالأعلى + درجة نشاط DAS28 + خريطة المفاصل ليقترح التشخيص الدقيق والتحذيرات والروشتة." />

            <TextInput style={[styles.input, styles.textArea]} placeholder="اختياري: أي ملاحظات سريرية أو شكاوى أخرى..." placeholderTextColor="#64748B" multiline numberOfLines={2} value={symptomsInput} onChangeText={setSymptomsInput} />

            <TouchableOpacity style={styles.aiButton} onPress={handleClinicalAnalysis} disabled={analyzing}>
              {analyzing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.aiButtonText}>✨ تحليل الحالة بناءً على الجدول والخريطة ({specialty})</Text>}
            </TouchableOpacity>

            {aiReport && (
              <View style={styles.aiReportBox}>
                <Text style={styles.aiReportHeader}>📋 التقرير الطبي المولد من الذكاء الاصطناعي:</Text>
                {aiReport.warnings && aiReport.warnings.length > 0 && (
                  <View style={styles.warningBox}>
                    {aiReport.warnings.map((w, idx) => <Text key={idx} style={styles.warningText}>⚠️ {w}</Text>)}
                  </View>
                )}
                <Text style={styles.aiDiagText}>
                  <Text style={{ fontWeight: 'bold' }}>التشخيص المقترح: </Text>
                  {aiReport.diagnosis}
                </Text>
                {aiReport.recommendedTests && aiReport.recommendedTests.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={{ color: '#00F2FE', fontSize: 11, fontWeight: 'bold', textAlign: 'right' }}>🔬 التحاليل المطلوبة للتأكيد:</Text>
                    {aiReport.recommendedTests.map((t, idx) => <Text key={idx} style={{ color: '#CBD5E1', fontSize: 11, textAlign: 'right' }}>• {t}</Text>)}
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📝 5. اعتماد الخطة العلاجية والروشتة النهائية</Text>

            <ClinicalHint text="راجع التشخيص النهائي والأدوية المقترحة، ويمكنك إضافة أي دواء مع فحص التفاعلات الدوائية تلقائياً قبل الطباعة." />

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
                <Text style={styles.medDetail}>
                  <Text style={{ fontWeight: 'bold' }}>الجرعة: </Text>
                  {med.dose}
                </Text>
                <Text style={styles.medDetail}>
                  <Text style={{ fontWeight: 'bold' }}>دواعي الاستعمال: </Text>
                  {med.reason}
                </Text>
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

  hintBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRightWidth: 3,
    borderRightColor: '#38BDF8',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 12,
    gap: 6
  },
  hintBannerIcon: { fontSize: 12, marginTop: 1 },
  hintBannerText: { flex: 1, color: '#BAE6FD', fontSize: 11, textAlign: 'right', lineHeight: 17 },

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
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 8, textAlign: 'right' },
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

  // --- أنماط جدول التحاليل وتقرير الأشعة المستخرج ---
  reExtractBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  reExtractBtnText: { color: '#00F2FE', fontSize: 11, fontWeight: 'bold' },
  extractingBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.16)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10
  },
  extractingBannerText: { color: '#00F2FE', fontSize: 12, fontWeight: 'bold' },
  labTableContainer: {
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#060911'
  },
  labTableHeaderRow: {
    flexDirection: 'row-reverse',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center'
  },
  labTableHeaderCell: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  labTableRow: {
    flexDirection: 'row-reverse',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center'
  },
  labCellInput: {
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 5,
    paddingHorizontal: 3,
    color: '#FFFFFF'
  },
  labRowDeleteBtn: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center'
  },
  labRowDeleteText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
  addLabRowBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8
  },
  addLabRowBtnText: { color: '#38BDF8', fontSize: 11, fontWeight: 'bold' },
  radiologySummaryBox: {
    backgroundColor: '#060911',
    borderWidth: 1,
    borderColor: '#0284C7',
    borderRadius: 8,
    padding: 10,
    marginTop: 4
  },
  radiologySummaryTitle: { color: '#00F2FE', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  radiologySummaryInput: { color: '#E2E8F0', fontSize: 12, textAlign: 'right', lineHeight: 18 },

  // --- أنماط حاسبة نشاط الروماتويد التلقائية (Auto DAS28 / CDAI) ---
  dasCalculatorBox: {
    backgroundColor: '#060911',
    borderWidth: 1,
    borderColor: '#0284C7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 14
  },
  dasTitle: { color: '#00F2FE', fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  dasBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1
  },
  dasBadgeText: { fontSize: 12, fontWeight: 'bold' },
  dasCountsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 8
  },
  dasCountPill: {
    backgroundColor: '#0F172A',
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  dasResultBanner: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    alignItems: 'center'
  },
  dasResultText: { fontSize: 13, fontWeight: 'bold', textAlign: 'center' },

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

  // --- أنماط الكاميرا والرفع المتعدد (محفوظة كما هي) ---
  aiUploadButtonsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
    marginBottom: 10
  },
  aiFilePickerLabel: {
    backgroundColor: '#0284C7',
    color: '#FFFFFF',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    border: '1px solid #00F2FE',
    display: 'inline-block',
    textAlign: 'center'
  },
  aiLiveCamBtn: {
    backgroundColor: '#047857',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center'
  },
  aiQrBridgeBtn: {
    backgroundColor: '#6D28D9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A78BFA',
    justifyContent: 'center',
    alignItems: 'center'
  },
  aiActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold'
  },
  directSaveScansBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  directSaveScansBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold'
  },

  bridgeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 9, 17, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  bridgeModalCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#0284C7'
  },
  bridgeModalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 10
  },
  bridgeModalTitle: {
    color: '#00F2FE',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right'
  },
  bridgeCloseBtn: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  bridgeCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold'
  },
  bridgeSubText: {
    color: '#CBD5E1',
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 19,
    marginBottom: 12
  },
  cameraSelectDropdown: {
    width: '100%',
    backgroundColor: '#060911',
    color: '#FFFFFF',
    border: '1px solid #0284C7',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '12px',
    fontWeight: 'bold',
    direction: 'rtl'
  },
  liveVideoFrame: {
    width: '100%',
    minHeight: 260,
    backgroundColor: '#000000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  cameraOverlayMsg: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bridgeActionRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 10
  },
  bridgeCaptureBtn: {
    flex: 2,
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981'
  },
  bridgePrimaryBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  bridgeDoneBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  bridgeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  bridgeHintText: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 17
  },
  qrBoxContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#060911',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12
  },
  qrSessionTag: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 8
  },
  qrStatusBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12
  },
  qrStatusBannerText: {
    color: '#E2E8F0',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 18
  },
  qrCounterBadge: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4
  },

  zoomMiniBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4
  },
  zoomMiniBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold'
  },
  labsSectionHeader: {
    marginTop: 10,
    marginBottom: 6
  },
  manualLockToggleBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8
  },
  manualLockToggleBtnLocked: {
    backgroundColor: '#1E293B',
    borderColor: '#00F2FE'
  },
  manualLockToggleBtnOpen: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444'
  },
  manualLockToggleBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold'
  },
  lockedLabsBanner: {
    backgroundColor: 'rgba(2, 132, 199, 0.14)',
    borderWidth: 1,
    borderColor: '#0284C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12
  },
  lockedLabsTitle: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 4
  },
  lockedLabsSub: {
    color: '#CBD5E1',
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 18
  },
  labsWrapperBox: {
    backgroundColor: 'rgba(6, 9, 17, 0.45)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 10
  },

  queryCheckBtn: { backgroundColor: '#1E293B', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155', alignItems: 'center', marginTop: 8 },
  queryCheckBtnActive: { backgroundColor: '#0284C7', borderColor: '#00F2FE' },
  queryCheckBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  provisionalBox: { backgroundColor: '#060911', padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#0284C7' },

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
  saveScansBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },

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
