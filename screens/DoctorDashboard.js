import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, ScrollView, 
  TouchableOpacity, Alert, ActivityIndicator, Platform, Image, Linking, Modal
} from 'react-native';
import { generatePrescriptionPDF } from '../components/PDFGenerator';
import { supabase } from '../supabaseClient';
import { verifyDoctorAccess } from '../src/services/subscriptionService';

// اعتماد مفتاح البيئة السري المسجل في Vercel مباشرة دون وضع نص صريح
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

const SPECIALITIES_LIST = [
  "استشاري أمراض القلب والباطنة",
  "استشاري أمراض الروماتيزم والروماتويد والأمراض المناعية",
  "استشاري طب الأطفال وحديثي الولادة",
  "استشاري جراحة العظام والمفاصل",
  "استشاري أمراض الباطنة والسكر"
];

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
    if (cleanSelected.includes(word)) {
      return true;
    }
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

  if (days > 0) {
    return `متبقي ${days} يوم و ${hours} ساعة و ${minutes} دقيقة`;
  } else if (hours > 0) {
    return `متبقي ${hours} ساعة و ${minutes} دقيقة فقط!`;
  } else {
    return `متبقي ${minutes} دقيقة فقط!`;
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

  const [activeTab, setActiveTab] = useState('prescription');
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
  const [familyHistory, setFamilyHistory] = useState('');
  const [selectedPatientCode, setSelectedPatientCode] = useState('');
  const [currentPatientId, setCurrentPatientId] = useState(null);

  const [symptomsInput, setSymptomsInput] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [scanGroupTitle, setScanGroupTitle] = useState('');

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
  const [patientScansGrid, setPatientScansGrid] = useState([]);
  const [searchingHistory, setSearchingHistory] = useState(false);
  const [allDoctorPatients, setAllDoctorPatients] = useState([]);
  const [loadingPatientsList, setLoadingPatientsList] = useState(false);

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
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
            const scanUrl = sc.url || sc.publicUrl || sc.publicURL;
            if (scanUrl) {
              allScans.push({ 
                url: scanUrl, 
                title: sc.title || 'أشعة ومستند طبّي', 
                recordId: r.id, 
                date: r.created_at || r.visit_date 
              });
            }
          });
        } else if (df.scanUrl) {
          allScans.push({ 
            url: df.scanUrl, 
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
      if (existingClinic) {
        clinicId = existingClinic.id;
      }

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
          publicUrl = urlData?.publicUrl || urlData?.publicURL || `https://emynlqikbdwogijqfbfw.supabase.co/storage/v1/object/public/clinic-assets/${filePath}`;
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

        if (!signInErr) {
          showAlert('تم إنشاء الحساب 🎉', 'تم إنشاء الحساب وتسجيل الدخول بنجاح!');
        } else {
          showAlert('تم إنشاء الحساب 🎉', 'تم إنشاء الحساب بنجاح!');
        }
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

  const handleCopyPortalLink = () => {
    const currentUserId = session?.user?.id;
    if (!currentUserId) return;
    const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin.split('?')[0] : 'https://medverse-emr-suite.vercel.app';
    const portalUrl = `${baseUrl}?c=${currentUserId}`;
    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(portalUrl);
      showAlert('تم النسخ! 📋', portalUrl);
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
          
          if (!isMatched) {
            setShowMismatchModal(true);
          } else {
            setSpecialty(clinic.specialty);
          }

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

      if (existingClinic) {
        await supabase.from('clinics').update(profilePayload).eq('id', existingClinic.id);
      } else {
        await supabase.from('clinics').insert([profilePayload]);
      }

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
    setActiveTab('prescription');
    fetchPatientScansByPatientId(patient.id);
  };

  const handleFillDummyData = () => {
    const dummyName = 'أحمد علي حسين';
    setPatientName(dummyName);
    setPatientPhone('01012345678');
    setAge('54');
    setGender('ذكر');
    setChronicDiseases('روماتويد مفصلي، ارتفاع ضغط الدم');
    setFamilyHistory('تاريخ عائلي للأمراض المناعية والروماتيزم');
    setSymptomsInput('آلام وآنتفاخ بالمعصمين واليدين صباحاً تستمر لأكثر من ساعة مع إجهاد عام.');
    setDoctorNotes('تحليل RF و Anti-CCP إيجابي مرتفع، ESR 45.');
    handleSearchPatientByName(dummyName);
  };

  const handleClinicalAnalysis = async () => {
    if (!symptomsInput.trim()) {
      showAlert('تنبيه', 'يرجى كتابة الأعراض والشكوى الحالية للمريض أولاً.');
      return;
    }

    setAnalyzing(true);
    setAiReport(null);

    const activeApiKey = GROQ_API_KEY;

    const systemPrompt = `You are an AI Clinical Assistant for a doctor in specialty: ${specialty}.
Analyze the patient case and respond ONLY with a clean JSON object without Markdown formatting or triple backticks.

Expected JSON Structure:
{
  "diagnosis": "English Diagnosis - الشرح بالعربي",
  "warnings": ["تحذير بالعربي"],
  "medications": [
    {
      "name": "Drug Name",
      "dose": "الجرعة بالعربي",
      "reason": "دواعي الاستعمال بالعربي"
    }
  ]
}`;

    const userPrompt = `Patient Specialty: ${specialty}
Age: ${age || 'غير محدد'} | Gender: ${gender}
Chronic: ${chronicDiseases || 'لا يوجد'}
Symptoms: ${symptomsInput}
Doctor Notes: ${doctorNotes || 'لا يوجد'}`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${activeApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `خطأ في استجابة السيرفر (${response.status})`);
      }

      const data = await response.json();
      const rawContent = data?.choices?.[0]?.message?.content;

      if (!rawContent) throw new Error('استجابة فارغة من خادم الذكاء الاصطناعي');

      const cleanJsonString = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedResult = JSON.parse(cleanJsonString);

      if (parsedResult.warnings) {
        parsedResult.warnings = parsedResult.warnings.map(w => sanitizeText(w));
      }

      setAiReport(parsedResult);
      if (parsedResult.diagnosis) setFinalDiagnosis(parsedResult.diagnosis);
      if (parsedResult.medications && Array.isArray(parsedResult.medications)) {
        setPrescribedMeds(parsedResult.medications);
      }

    } catch (error) {
      console.error("Groq Analysis Error:", error);
      showAlert('تنبيه الذكاء الاصطناعي', `تعذر التحليل التلقائي: ${error.message}\nيمكنك كتابة التشخيص والأدوية يدوياً والاستمرار بشكل طبيعي.`);
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

  const executeSaveAndPrint = async () => {
    setLoading(true);
    const generatedCode = selectedPatientCode || ('PAT-' + Math.floor(10000 + Math.random() * 90000));

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
              familyHistory, 
              symptoms: symptomsInput, 
              doctorNotes
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
          'ملاحظات الفحوصات والأشعة': doctorNotes || 'لا يوجد'
        },
        prescribedMeds,
        {
          doctorName: clinicDoctorName,
          clinicName: clinicName,
          specialty: specialty,
          logoUrl: clinicLogoUrl,
          stampUrl: digitalStampUrl,
          phone: clinicPhone,
          address: clinicAddress
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
              <Image source={{ uri: viewingImageModal.url }} style={{ width: 340 * zoomScale, height: 340 * zoomScale, borderRadius: 8, resizeMode: 'contain' }} />
              <Text style={styles.lightboxTitle}>{viewingImageModal.title}</Text>
            </ScrollView>
          )}
        </View>
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

      {/* Header */}
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
        <Text style={styles.subtitle}>منظومة إدارة العيادات والأشعة الذكية ({specialty})</Text>
      </View>

      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={[styles.navBtn, activeTab === 'prescription' && styles.navBtnActive]} onPress={() => setActiveTab('prescription')}>
          <Text style={[styles.navBtnText, activeTab === 'prescription' && styles.navBtnTextActive]}>🩺 الكشف والأشعة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, activeTab === 'patients' && styles.navBtnActive]} onPress={() => { setActiveTab('patients'); fetchAllPatients(); }}>
          <Text style={[styles.navBtnText, activeTab === 'patients' && styles.navBtnTextActive]}>📂 قائمة المرضى</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, activeTab === 'profile' && styles.navBtnActive]} onPress={() => setActiveTab('profile')}>
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
            <TextInput style={styles.input} placeholder="مثال: أمراض مناعية..." placeholderTextColor="#64748B" value={familyHistory} onChangeText={setFamilyHistory} />
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
                          <Image 
                            source={{ uri: sc.url }} 
                            style={styles.scanGridImg} 
                            resizeMode="cover"
                          />
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
                          <Image source={{ uri: item.previewUrl }} style={styles.scanPreviewImg} />
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

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🩺 الشكوى الحالية والفحوصات الإكلينيكية</Text>
            
            <Text style={styles.label}>الأعراض والشكوى الحالية:</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="صف الأعراض بالتفصيل..." placeholderTextColor="#64748B" multiline numberOfLines={3} value={symptomsInput} onChangeText={setSymptomsInput} />

            <Text style={styles.label}>ملاحظات الفحوصات والتحاليل والمتابعة:</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="اكتب نتائج تحاليل RF, Anti-CCP أو الأشعة..." placeholderTextColor="#64748B" multiline numberOfLines={2} value={doctorNotes} onChangeText={setDoctorNotes} />

            <TouchableOpacity style={styles.aiButton} onPress={handleClinicalAnalysis} disabled={analyzing}>
              {analyzing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.aiButtonText}>✨ تحليل الحالة بـ LLaMA 3.3 70B AI ({specialty})</Text>}
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
              <TextInput style={styles.input} placeholder="اسم الدواء (إنجليزي)" placeholderTextColor="#64748B" value={newMedName} onChangeText={setNewMedName} />
              <TextInput style={styles.input} placeholder="الجرعة والتوقيت" placeholderTextColor="#64748B" value={newMedDose} onChangeText={setNewMedDose} />
              <TextInput style={styles.input} placeholder="دواعي الاستعمال" placeholderTextColor="#64748B" value={newMedReason} onChangeText={setNewMedReason} />
              
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
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D16', padding: 14 },
  header: { marginBottom: 15, alignItems: 'center', marginTop: 10 },
  title: { fontSize: 22, fontWeight: '900', color: '#00F2FE', letterSpacing: 0.5 },
  subtitle: { fontSize: 12, color: '#94A3B8', marginTop: 3, fontWeight: '600' },

  topUserRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', width: '100%', marginBottom: 10, alignItems: 'center' },
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

  authCard: { backgroundColor: '#131C2E', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1E293B' },
  authTitle: { fontSize: 20, fontWeight: 'bold', color: '#00F2FE', textAlign: 'center', marginBottom: 5 },
  authSub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 20 },
  authSubmitBtn: { backgroundColor: '#0284C7', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  authSubmitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  authToggleBtn: { marginTop: 15, alignItems: 'center' },
  authToggleBtnText: { color: '#38BDF8', fontSize: 12 },

  paywallCard: { backgroundColor: '#131C2E', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#EF4444', alignItems: 'center' },
  paywallIcon: { fontSize: 40, marginBottom: 10 },
  paywallTitle: { fontSize: 20, fontWeight: 'bold', color: '#EF4444', marginBottom: 8 },
  paywallReason: { fontSize: 13, color: '#FCA5A5', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  paywallInfoBox: { backgroundColor: '#090D16', padding: 15, borderRadius: 10, width: '100%', marginBottom: 15, borderWidth: 1, borderColor: '#1E293B' },
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

  navBar: { flexDirection: 'row-reverse', backgroundColor: '#131C2E', borderRadius: 12, padding: 4, marginBottom: 15, borderWidth: 1, borderColor: '#1E293B' },
  navBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  navBtnActive: { backgroundColor: '#0284C7' },
  navBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold' },
  navBtnTextActive: { color: '#FFFFFF' },

  card: { backgroundColor: '#131C2E', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#1E293B' },
  cardHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dummyBtn: { backgroundColor: '#0284C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  dummyBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 10, textAlign: 'right' },
  subSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#38BDF8', marginTop: 12, marginBottom: 8, textAlign: 'right' },
  label: { fontSize: 12, color: '#CBD5E1', marginBottom: 4, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#1E293B', borderRadius: 10, padding: 12, backgroundColor: '#090D16', marginBottom: 12, textAlign: 'right', color: '#FFFFFF', fontSize: 13 },
  inputDisabled: { opacity: 0.5, backgroundColor: '#1E293B' },
  rowInputs: { flexDirection: 'row-reverse' },
  textArea: { height: 70, textAlignVertical: 'top' },
  
  specChip: { backgroundColor: '#090D16', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#1E293B' },
  specChipActive: { backgroundColor: '#0284C7', borderColor: '#00F2FE' },
  specChipText: { color: '#94A3B8', fontSize: 11 },
  specChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },

  patientChip: { backgroundColor: '#090D16', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 6, borderWidth: 1, borderColor: '#1E293B' },
  patientChipActive: { backgroundColor: '#0369A1', borderColor: '#00F2FE' },
  patientChipText: { color: '#CBD5E1', fontSize: 11 },
  patientChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  selectedCodeBadge: { color: '#10B981', fontSize: 11, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 },
  whatsappShareBtn: { backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
  whatsappShareBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },

  scanPreviewCard: { marginRight: 10, backgroundColor: '#090D16', padding: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  scanPreviewImg: { width: 100, height: 100, borderRadius: 6 },
  deleteScanBtn: { backgroundColor: '#991B1B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginTop: 4 },
  deleteScanBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },

  scansGridContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  scanGridCard: { width: '31%', backgroundColor: '#090D16', padding: 6, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  scanGridImg: { width: '100%', height: 90, borderRadius: 8, backgroundColor: '#1E293B' },
  scanGridTitle: { color: '#94A3B8', fontSize: 10, marginTop: 4, textAlign: 'center' },
  scanGridDeleteBtn: { backgroundColor: '#991B1B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, width: '100%', alignItems: 'center' },
  scanGridDeleteText: { color: '#FFFFFF', fontSize: 10 },

  progressBarContainer: { height: 18, backgroundColor: '#090D16', borderRadius: 9, overflow: 'hidden', marginBottom: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#1E293B' },
  progressBarFill: { height: '100%', backgroundColor: '#059669', position: 'absolute' },
  progressText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', textAlign: 'center', zIndex: 1 },

  warningInfoBox: { backgroundColor: 'rgba(234, 179, 8, 0.15)', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#EAB308', marginBottom: 10 },
  warningInfoText: { color: '#FDE047', fontSize: 11, textAlign: 'right', lineHeight: 18 },

  saveScansBtn: { backgroundColor: '#10B981', padding: 14, borderRadius: 10, alignItems: 'center' },
  saveScansBtnDisabled: { backgroundColor: '#334155', opacity: 0.6 },
  saveScansBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },

  deleteImgBtn: { backgroundColor: '#991B1B', padding: 6, borderRadius: 6, marginTop: 6, alignItems: 'center' },
  deleteImgBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },

  linkCardBox: { backgroundColor: '#090D16', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#0284C7' },
  linkBoxTitle: { fontSize: 13, fontWeight: 'bold', color: '#00F2FE', textAlign: 'right' },
  linkBoxSub: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 2, marginBottom: 8 },
  copyLinkBtn: { backgroundColor: '#0284C7', padding: 10, borderRadius: 6, alignItems: 'center' },
  copyLinkBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },

  previewBox: { backgroundColor: '#090D16', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#1E293B' },
  stampImage: { width: 120, height: 80, marginTop: 5 },
  saveProfileBtn: { backgroundColor: '#10B981', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  saveProfileBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },

  patientListItem: { backgroundColor: '#090D16', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#1E293B' },
  patientItemName: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' },
  patientItemCode: { fontSize: 12, color: '#00F2FE', fontWeight: 'bold' },
  patientItemSub: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 4 },
  emptyText: { color: '#64748B', fontSize: 12, textAlign: 'center', marginVertical: 10 },

  historyRecordCard: { backgroundColor: '#090D16', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#1E293B' },
  historyDate: { color: '#38BDF8', fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  historyDiagnosis: { color: '#F8FAFC', fontSize: 13, marginTop: 4, textAlign: 'right' },

  aiButton: { backgroundColor: '#0284C7', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12, marginTop: 5 },
  aiButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  aiReportBox: { backgroundColor: 'rgba(3, 105, 161, 0.2)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#0284C7' },
  aiReportHeader: { fontSize: 12, fontWeight: 'bold', color: '#00F2FE', marginBottom: 6, textAlign: 'right' },
  warningBox: { backgroundColor: 'rgba(153, 27, 27, 0.4)', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#EF4444', marginTop: 6, marginBottom: 6 },
  warningText: { color: '#FCA5A5', fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  aiDiagText: { fontSize: 12, color: '#F8FAFC', textAlign: 'right' },
  medCard: { backgroundColor: '#090D16', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1E293B', marginBottom: 10 },
  medHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  medName: { fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' },
  deleteText: { color: '#EF4444', fontSize: 11, fontWeight: 'bold' },
  medDetail: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 2 },
  addMedBox: { backgroundColor: '#090D16', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#1E293B' },
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
  modalContent: { backgroundColor: '#131C2E', padding: 20, borderRadius: 16, width: '100%', maxWidth: 450, borderWidth: 1, borderColor: '#EF4444' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#EF4444', marginBottom: 8, textAlign: 'right' },
  modalSub: { fontSize: 13, color: '#CBD5E1', marginBottom: 20, textAlign: 'right', lineHeight: 20 },
  modalButtonsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  modalStayBtn: { flex: 1, backgroundColor: '#1E293B', padding: 10, borderRadius: 8, alignItems: 'center' },
  modalStayBtnText: { color: '#94A3B8', fontSize: 11, fontWeight: 'bold' },
  modalGoBtn: { flex: 1.2, backgroundColor: '#0284C7', padding: 10, borderRadius: 8, alignItems: 'center' },
  modalGoBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' }
});
