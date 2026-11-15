import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
  ActivityIndicator
} from 'react-native';
import DoctorDashboard from './screens/DoctorDashboard';
import PatientPortal from './screens/PatientPortal';
import { supabase } from './supabaseClient';

// --- تحويل DataURL (Base64) إلى Blob جاهز للرفع السحابي ---
const dataURLtoBlob = (dataUrl) => {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

// --- معالجة وتحسين دقة وتباين الصور على الهاتف وإخراج Base64 مستقر يمنع اختفاء الصور ---
const enhanceMobileScanImageToBase64 = (file, maxWidth = 1800, quality = 0.88) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result;
      if (!rawDataUrl) {
        reject(new Error('تعذر قراءة ملف الصورة'));
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (!width || !height) {
            resolve(rawDataUrl);
            return;
          }

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else if (width < 1200) {
            const scale = Math.min(1600 / width, 1.4);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          if (typeof ctx.filter !== 'undefined') {
            ctx.filter = 'contrast(1.16) brightness(1.03) saturate(1.04)';
          }
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl || rawDataUrl);
        } catch (err) {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.onerror = () => reject(new Error('فشل قراءة الصورة من الجهاز'));
    reader.readAsDataURL(file);
  });
};

// --- واجهة الماسح السريع للهاتف: تجميع ومراجعة الصور ثم الإرسال دفعة واحدة ---
function MobileScannerBridge({ sessionId }) {
  const storageKey = `medverse_qr_queue_${sessionId}`;

  // استرجاع الصور المجمعة من sessionStorage لحمايتها من الضياع إذا أعاد متصفح الهاتف تحميل الصفحة بعد الكاميرا
  const [queuedPhotos, setQueuedPhotos] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const saved = sessionStorage.getItem(storageKey);
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [sentPhotos, setSentPhotos] = useState([]);
  const [preparing, setPreparing] = useState(false);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [statusMessage, setStatusMessage] = useState(
    'التقط صوراً بالكاميرا أو اخترها من الاستوديو لتجميعها هنا، ثم اضغط زر الإرسال دفعة واحدة'
  );

  // مزامنة قائمة الانتظار تلقائياً مع sessionStorage
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(queuedPhotos));
      } catch (e) {
        // تجاهل في حال امتلاء سعة التخزين المؤقتة
      }
    }
  }, [queuedPhotos, storageKey]);

  // 1. إضافة الصور الملتقطة أو المختارة إلى سلة التجميع دون مسح الصور السابقة
  const handleAddFilesToQueue = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setPreparing(true);
    setStatusMessage(`جاري تجهيز وتحسين دقة (${files.length}) صورة وإضافتها للقائمة...`);

    try {
      const newlyPrepared = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64DataUrl = await enhanceMobileScanImageToBase64(file, 1800, 0.88);
        const uniqueId = `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
        const title = file.name
          ? file.name.replace(/\.[^/.]+$/, '')
          : `ورقة فحص #${queuedPhotos.length + sentPhotos.length + i + 1}`;

        newlyPrepared.push({
          id: uniqueId,
          base64: base64DataUrl,
          title
        });
      }

      setQueuedPhotos((prev) => {
        const updated = [...prev, ...newlyPrepared];
        setStatusMessage(
          `📋 لديك الآن (${updated.length}) صورة جاهزة للمراجعة. يمكنك إضافة المزيد أو الضغط على زر الإرسال بالأسفل.`
        );
        return updated;
      });
    } catch (err) {
      setStatusMessage(`⚠️ تعذر تجهيز بعض الصور: ${err.message}`);
    } finally {
      setPreparing(false);
      if (event.target) event.target.value = '';
    }
  };

  // 2. حذف صورة من سلة التجميع قبل الإرسال
  const handleRemoveFromQueue = (id) => {
    setQueuedPhotos((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      if (updated.length === 0) {
        setStatusMessage('تم مسح القائمة. يمكنك التقاط أو اختيار صور جديدة.');
      } else {
        setStatusMessage(`📋 متبقي (${updated.length}) صورة جاهزة للإرسال.`);
      }
      return updated;
    });
  };

  // 3. إرسال جميع الصور المجمعة دفعة واحدة إلى نظام الطبيب بعد التأكيد
  const handleSendAllQueuedPhotos = async () => {
    if (queuedPhotos.length === 0 || sendingBatch) return;

    setSendingBatch(true);
    const totalToSend = queuedPhotos.length;
    setSendProgress({ current: 0, total: totalToSend });
    setStatusMessage(`🚀 جاري إرسال (${totalToSend}) صورة دفعة واحدة إلى شاشة الطبيب...`);

    const successfullySent = [];
    const failedItems = [];
    const batchBaseTime = Date.now();

    for (let i = 0; i < queuedPhotos.length; i++) {
      const item = queuedPhotos[i];
      setSendProgress({ current: i + 1, total: totalToSend });

      try {
        const blob = dataURLtoBlob(item.base64);
        const paddedIndex = String(i).padStart(3, '0');
        const uniqueSuffix = Math.random().toString(36).substring(2, 6);
        const fileName = `${batchBaseTime}_${paddedIndex}_${uniqueSuffix}.jpg`;
        const filePath = `qr_sessions/${sessionId}/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('clinic-assets')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            cacheControl: '0',
            upsert: false
          });

        if (uploadErr) {
          throw new Error(uploadErr.message || 'فشل رفع الصورة للسحابة');
        }

        const { data: urlData } = supabase.storage
          .from('clinic-assets')
          .getPublicUrl(filePath);

        const publicUrl =
          urlData?.publicUrl ||
          `https://emynlqikbdwogijqfbfw.supabase.co/storage/v1/object/public/clinic-assets/${filePath}`;

        // محاولة التسجيل في جدول الجلسات إن وجد (مع عدم إيقاف العملية إذا لم يكن الجدول مفعلاً لأن اللابتوب يقرأ من Storage مباشرة)
        await supabase
          .from('qr_session_photos')
          .insert([
            {
              session_id: sessionId,
              file_name: fileName,
              public_url: publicUrl
            }
          ])
          .catch(() => {});

        successfullySent.push({
          ...item,
          publicUrl,
          sentAt: new Date().toISOString()
        });
      } catch (err) {
        failedItems.push({
          ...item,
          errorText: err.message
        });
      }
    }

    if (successfullySent.length > 0) {
      setSentPhotos((prev) => [...prev, ...successfullySent]);
    }

    setQueuedPhotos(failedItems);

    if (failedItems.length === 0) {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(storageKey);
      }
      setStatusMessage(
        `✅ تم إرسال (${successfullySent.length}) صورة دفعة واحدة بنجاح! ظهرت الآن على شاشة الطبيب. يمكنك تصوير دفعة جديدة إذا أردت.`
      );
    } else {
      setStatusMessage(
        `⚠️ تم إرسال (${successfullySent.length}) صورة، وتعذر إرسال (${failedItems.length}) صورة. اضغط زر الإرسال لإعادة محاولة المتبقي.`
      );
    }

    setSendingBatch(false);
  };

  return (
    <ScrollView contentContainerStyle={scannerStyles.container}>
      <View style={scannerStyles.card}>
        <Text style={scannerStyles.badge}>📱 LIVE QR CAMERA BRIDGE</Text>
        <Text style={scannerStyles.title}>ماسح التحاليل والأشعة المجمع</Text>
        <Text style={scannerStyles.sessionCode}>كود الجلسة المتصلة: {sessionId}</Text>

        <View style={scannerStyles.statusBox}>
          <Text style={scannerStyles.statusText}>{statusMessage}</Text>
        </View>

        {/* أزرار الالتقاط والاختيار التراكمي */}
        {!sendingBatch && (
          <View style={scannerStyles.buttonsColumn}>
            {Platform.OS === 'web' && (
              <>
                <label style={scannerStyles.cameraBtnLabel}>
                  📸 التقط صورة بالكاميرا وأضفها للقائمة
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={preparing}
                    onChange={handleAddFilesToQueue}
                    style={{ display: 'none' }}
                  />
                </label>

                <label style={scannerStyles.galleryBtnLabel}>
                  🖼️ اختر صورة أو أكثر من الاستوديو
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={preparing}
                    onChange={handleAddFilesToQueue}
                    style={{ display: 'none' }}
                  />
                </label>
              </>
            )}
          </View>
        )}

        {preparing && (
          <View style={{ marginVertical: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color="#00F2FE" />
            <Text style={{ color: '#00F2FE', fontWeight: 'bold', fontSize: 12 }}>
              جاري تحسين وضوح الصورة وإضافتها للسلة...
            </Text>
          </View>
        )}

        {/* قسم 1: الصور المجمعة في انتظار التأكيد والإرسال دفعة واحدة */}
        {queuedPhotos.length > 0 && (
          <View style={scannerStyles.queueSection}>
            <View style={scannerStyles.queueHeaderRow}>
              <Text style={scannerStyles.queueHeader}>
                📋 صور جاهزة للإرسال ({queuedPhotos.length}) - راجعها قبل الإرسال:
              </Text>
              {!sendingBatch && (
                <TouchableOpacity
                  onPress={() => setQueuedPhotos([])}
                  style={scannerStyles.clearQueueBtn}
                >
                  <Text style={scannerStyles.clearQueueText}>مسح الكل</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={scannerStyles.thumbsGrid}>
              {queuedPhotos.map((item, idx) => (
                <View key={item.id} style={scannerStyles.queueThumbCard}>
                  {Platform.OS === 'web' && (
                    <img
                      src={item.base64}
                      alt={item.title}
                      style={{ width: '100%', height: '90px', borderRadius: '6px', objectFit: 'cover' }}
                    />
                  )}
                  <Text style={scannerStyles.queueThumbLabel} numberOfLines={1}>
                    #{idx + 1} جاهزة
                  </Text>
                  {!sendingBatch && (
                    <TouchableOpacity
                      style={scannerStyles.removeThumbBtn}
                      onPress={() => handleRemoveFromQueue(item.id)}
                    >
                      <Text style={scannerStyles.removeThumbText}>✕ حذف</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {/* زر الإرسال المجمع دفعة واحدة */}
            <TouchableOpacity
              style={[scannerStyles.sendBatchBtn, sendingBatch && { opacity: 0.7 }]}
              onPress={handleSendAllQueuedPhotos}
              disabled={sendingBatch || preparing}
            >
              {sendingBatch ? (
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={scannerStyles.sendBatchBtnText}>
                    جاري إرسال ({sendProgress.current} من {sendProgress.total})...
                  </Text>
                </View>
              ) : (
                <Text style={scannerStyles.sendBatchBtnText}>
                  🚀 تأكيد وإرسال ({queuedPhotos.length}) صورة دفعة واحدة للنظام
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* قسم 2: الصور التي تم إرسالها بنجاح بالفعل لشاشة الطبيب */}
        {sentPhotos.length > 0 && (
          <View style={scannerStyles.sentSection}>
            <Text style={scannerStyles.sentHeader}>
              ✅ تم إرسالها بنجاح لشاشة الطبيب ({sentPhotos.length}):
            </Text>
            <View style={scannerStyles.thumbsGrid}>
              {sentPhotos.map((item, idx) => (
                <View key={item.id} style={scannerStyles.thumbCard}>
                  {Platform.OS === 'web' && (
                    <img
                      src={item.base64}
                      alt={item.title}
                      style={{ width: '100%', height: '80px', borderRadius: '6px', objectFit: 'cover' }}
                    />
                  )}
                  <Text style={scannerStyles.thumbLabel} numberOfLines={1}>
                    #{idx + 1} وصلت ✓
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={scannerStyles.footerNote}>
          💡 التقط كل الأوراق التي تريدها أولاً، تأكد من وضوحها في المعاينة، ثم اضغط زر الإرسال الأخضر لإرسالها دفعة واحدة.
        </Text>
      </View>
    </ScrollView>
  );
}

export default function App() {
  // 1. قراءة واسترجاع الحالة السابقة من الـ localStorage لمنع الخروج عند الـ Refresh
  const [currentStep, setCurrentStep] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('medverse_current_step') || 'landing';
    }
    return 'landing';
  });

  const [selectedSpecialty, setSelectedSpecialty] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('medverse_selected_specialty') || '';
    }
    return '';
  });

  const [encryptedClinicId, setEncryptedClinicId] = useState(null);
  const [directPatientCode, setDirectPatientCode] = useState(null);
  const [qrScanSessionId, setQrScanSessionId] = useState(null);

  const specialties = [
    { id: 'internal', name: '🩺 الطب الباطني والأمراض المزمنة' },
    { id: 'rheumatology', name: '🩺 أمراض الروماتيزم والروماتويد والأمراض المناعية' },
    { id: 'pediatrics', name: '👶 طب الأطفال وحديثي الولادة' },
    { id: 'cardiology', name: '❤️ أمراض القلب والأوعية الدموية' },
    { id: 'surgery', name: '🔪 الجراحة العامة' },
    { id: 'orthopedics', name: '🦴 جراحة العظام والمفاصل' },
    { id: 'dermatology', name: '✨ الجلدية والتجميل' },
  ];

  // 2. معالجة روابط الـ URL الخارجية المباشرة (جلسة QR كاميرا الهاتف أو روابط العيادة/المريض)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const scanSessionParam = urlParams.get('scan_session');
      if (scanSessionParam) {
        setQrScanSessionId(scanSessionParam);
        return;
      }

      const queryParam = urlParams.get('clinic') || urlParams.get('c') || urlParams.get('patient');
      if (queryParam) {
        if (queryParam.startsWith('PAT-')) {
          setDirectPatientCode(queryParam);
          setEncryptedClinicId(null);
        } else {
          setEncryptedClinicId(queryParam);
          setDirectPatientCode(null);
        }
        updateStep('patient');
      }
    }
  }, []);

  // 3. دالة تحديث الشاشات والحفظ التلقائي في الـ LocalStorage
  const updateStep = (newStep) => {
    setCurrentStep(newStep);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('medverse_current_step', newStep);
    }
  };

  const updateSpecialty = (newSpec) => {
    setSelectedSpecialty(newSpec || '');
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('medverse_selected_specialty', newSpec || '');
    }
  };

  const handleSpecialtySelect = (specialtyName) => {
    updateSpecialty(specialtyName);
    updateStep('doctor');
  };

  const handleResetToLanding = () => {
    updateSpecialty('');
    setDirectPatientCode(null);
    setEncryptedClinicId(null);
    setQrScanSessionId(null);
    updateStep('landing');

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('medverse_current_step');
      localStorage.removeItem('medverse_selected_specialty');
      localStorage.removeItem('medverse_doctor_active_tab');
    }
  };

  // إذا فُتح الرابط من الهاتف عبر مسح QR Code الجلسة، نعرض شاشة الماسح السريع مباشرة
  if (qrScanSessionId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#060911" />
        <MobileScannerBridge sessionId={qrScanSessionId} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#060911" />

      {currentStep !== 'landing' && (
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleResetToLanding}
          >
            <Text style={styles.backButtonText}>🏠 القائمة الرئيسية / تغيير البوابة</Text>
          </TouchableOpacity>
          {selectedSpecialty !== '' && currentStep === 'doctor' && (
            <Text style={styles.specialtyBadge}>{selectedSpecialty}</Text>
          )}
        </View>
      )}

      {currentStep === 'landing' && (
        <ScrollView contentContainerStyle={styles.landingContainer}>
          {/* Header & Branding Zone */}
          <View style={styles.headerGlowBox}>
            <Text style={styles.mainTitle}>MedVerse EMR Suite</Text>
            
            {/* DEVEXT Brand Badge */}
            <View style={styles.brandRow}>
              <Text style={styles.brandTag}>POWERED BY</Text>
              <Text style={styles.brandSubtitle}>DEVEXT</Text>
            </View>

            <Text style={styles.subTitle}>منظومة السجلات الطبية الإلكترونية الذكية</Text>
          </View>

          <Text style={styles.selectPrompt}>الرجاء اختيار البوابة لدخول النظام:</Text>

          {/* Portal Cards */}
          <View style={styles.portalCardsContainer}>
            <TouchableOpacity 
              style={[styles.portalCard, styles.doctorCard]} 
              onPress={() => updateStep('specialty')}
              activeOpacity={0.8}
            >
              <View style={styles.portalHeaderRow}>
                <Text style={styles.portalIcon}>🩺</Text>
                <Text style={styles.badgeTagDoc}>SPECIALIST</Text>
              </View>
              <Text style={styles.portalTitle}>بوابة الطبيب</Text>
              <Text style={styles.portalDesc}>إدارة المرضى، الاستشارات الإكلينيكية الذكية بـ LLaMA AI، وإصدار الروشتات المعتمدة</Text>
              <View style={styles.cardActionRow}>
                <Text style={styles.actionText}>الدخول للوحة التحكم ←</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.portalCard, styles.patientCard]} 
              onPress={() => updateStep('patient')}
              activeOpacity={0.8}
            >
              <View style={styles.portalHeaderRow}>
                <Text style={styles.portalIcon}>👤</Text>
                <Text style={styles.badgeTagPat}>PATIENT PORTAL</Text>
              </View>
              <Text style={styles.portalTitle}>بوابة المريض</Text>
              <Text style={styles.portalDesc}>متابعة السجل الطبي، معاينة وتكبير صور الأشعة بدقة عالية Ultra Zoom، الروشتات والمواعيد</Text>
              <View style={styles.cardActionRow}>
                <Text style={styles.actionTextPatient}>استعراض الملف الطبي ←</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentStep === 'specialty' && (
        <ScrollView contentContainerStyle={styles.specialtyContainer}>
          <Text style={styles.sectionTitle}>اختر التخصص الطبي</Text>
          <Text style={styles.sectionSub}>ليتم تهيئة الواجهة وأدوات التشخيص المناسبة لعيادتك</Text>

          <View style={styles.grid}>
            {specialties.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.specialtyCard}
                onPress={() => handleSpecialtySelect(item.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.specialtyText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {currentStep === 'doctor' && (
        <View style={styles.body}>
          <DoctorDashboard 
            specialty={selectedSpecialty} 
            onSwitchPortal={handleResetToLanding}
            onUpdateSpecialty={(newSpec) => updateSpecialty(newSpec)}
          />
        </View>
      )}

      {currentStep === 'patient' && (
        <View style={styles.body}>
          <PatientPortal 
            onBackToDashboard={handleResetToLanding} 
            doctorClinicId={encryptedClinicId}
            initialPatientCode={directPatientCode}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const scannerStyles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '90%'
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#0284C7',
    alignItems: 'center'
  },
  badge: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00F2FE',
    marginBottom: 10
  },
  title: {
    fontSize: 21,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4
  },
  sessionCode: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: 'bold',
    marginBottom: 14
  },
  statusBox: {
    width: '100%',
    backgroundColor: '#060911',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600'
  },
  buttonsColumn: {
    width: '100%',
    gap: 12
  },
  cameraBtnLabel: {
    backgroundColor: '#1E293B',
    color: '#00F2FE',
    padding: '15px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 'bold',
    textAlign: 'center',
    cursor: 'pointer',
    border: '1.5px solid #00F2FE',
    display: 'block'
  },
  galleryBtnLabel: {
    backgroundColor: '#0284C7',
    color: '#FFFFFF',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 'bold',
    textAlign: 'center',
    cursor: 'pointer',
    border: '1px solid #38BDF8',
    display: 'block'
  },
  queueSection: {
    width: '100%',
    marginTop: 18,
    padding: 12,
    backgroundColor: '#060911',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F59E0B'
  },
  queueHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  queueHeader: {
    color: '#FBBF24',
    fontSize: 12.5,
    fontWeight: 'bold',
    textAlign: 'right',
    flex: 1
  },
  clearQueueBtn: {
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  clearQueueText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold'
  },
  queueThumbCard: {
    width: '31%',
    backgroundColor: '#0F172A',
    padding: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    alignItems: 'center'
  },
  queueThumbLabel: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4
  },
  removeThumbBtn: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
    width: '100%',
    alignItems: 'center'
  },
  removeThumbText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold'
  },
  sendBatchBtn: {
    backgroundColor: '#059669',
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    borderWidth: 2,
    borderColor: '#10B981'
  },
  sendBatchBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '900',
    textAlign: 'center'
  },
  sentSection: {
    width: '100%',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E293B'
  },
  sentHeader: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 10
  },
  thumbsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8
  },
  thumbCard: {
    width: '31%',
    backgroundColor: '#060911',
    padding: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center'
  },
  thumbLabel: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4
  },
  footerNote: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18
  }
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060911', paddingTop: Platform.OS === 'web' ? 0 : 0 },
  topBar: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#0F172A', paddingHorizontal: 15, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1E293B'
  },
  backButton: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  backButtonText: { color: '#00F2FE', fontSize: 13, fontWeight: 'bold' },
  specialtyBadge: { color: '#FFFFFF', backgroundColor: '#0284C7', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  
  landingContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  headerGlowBox: { alignItems: 'center', marginTop: 20, marginBottom: 25 },
  mainTitle: { 
    fontSize: 32, 
    fontWeight: '900', 
    color: '#00F2FE', 
    textAlign: 'center', 
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 242, 254, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 6, gap: 6 },
  brandTag: { fontSize: 10, color: '#64748B', fontWeight: 'bold', letterSpacing: 1 },
  brandSubtitle: { 
    fontSize: 14, 
    fontWeight: '900', 
    color: '#38BDF8', 
    letterSpacing: 2.5, 
    textShadowColor: 'rgba(56, 189, 248, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10 
  },
  subTitle: { fontSize: 14, color: '#94A3B8', marginTop: 4, textAlign: 'center', fontWeight: '600' },
  selectPrompt: { fontSize: 16, color: '#F8FAFC', marginBottom: 20, fontWeight: '700' },
  
  portalCardsContainer: { width: '100%', maxWidth: 480, gap: 18 },
  portalCard: { 
    padding: 22, 
    borderRadius: 18, 
    borderWidth: 1, 
    borderColor: '#1E293B',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
  },
  doctorCard: { 
    backgroundColor: '#0F172A',
    borderRightWidth: 4,
    borderRightColor: '#00F2FE'
  },
  patientCard: { 
    backgroundColor: '#0B132B',
    borderRightWidth: 4,
    borderRightColor: '#38BDF8'
  },
  portalHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  portalIcon: { fontSize: 36 },
  badgeTagDoc: { backgroundColor: 'rgba(0, 242, 254, 0.12)', color: '#00F2FE', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#00F2FE' },
  badgeTagPat: { backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#38BDF8' },
  portalTitle: { fontSize: 21, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 6, textAlign: 'right' },
  portalDesc: { fontSize: 12.5, color: '#94A3B8', textAlign: 'right', lineHeight: 20, marginBottom: 15 },
  
  cardActionRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10, alignItems: 'flex-start' },
  actionText: { color: '#00F2FE', fontSize: 12, fontWeight: 'bold' },
  actionTextPatient: { color: '#38BDF8', fontSize: 12, fontWeight: 'bold' },

  specialtyContainer: { padding: 20, alignItems: 'center' },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginTop: 15 },
  sectionSub: { fontSize: 13, color: '#94A3B8', marginBottom: 20, textAlign: 'center' },
  grid: { width: '100%', maxWidth: 480, gap: 10 },
  specialtyCard: { backgroundColor: '#0F172A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', alignItems: 'center' },
  specialtyText: { color: '#F8FAFC', fontSize: 14, fontWeight: 'bold' },
  body: { flex: 1 }
});
