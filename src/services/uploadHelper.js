import { supabase } from '../../supabaseClient';

// دالة مساعدة لضغط الصور وتصغير حجمها للحفاظ على سرعة الرفع والأداء
const compressImageBlob = (blob, maxWidth = 1000, quality = 0.8) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !blob.type.includes('image')) {
      return resolve(blob); // إذا لم تكن صورة أو كنا خارج البيئة التفاعلية نرجع الملف كما هو
    }

    const img = new Image();
    img.src = URL.createObjectURL(blob);
    img.onload = () => {
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

      canvas.toBlob(
        (compressedBlob) => {
          resolve(compressedBlob || blob);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => resolve(blob);
  );
};

export const uploadMediaFile = async (fileInput, fileName, onProgress = null) => {
  try {
    if (onProgress) onProgress(20);

    let blob;
    if (typeof fileInput === 'string') {
      // في حال تمرير File URI أو Base64
      const response = await fetch(fileInput);
      blob = await response.blob();
    } else if (fileInput instanceof Blob || fileInput instanceof File) {
      blob = fileInput;
    } else {
      throw new Error('نوع الملف غير مدعوم');
    }

    // 1. ضغط الصورة تقليلاً للحجم
    if (onProgress) onProgress(40);
    const compressedBlob = await compressImageBlob(blob, 1000, 0.8);

    const cleanFileName = fileName || `file_${Date.now()}.jpg`;
    const filePath = `uploads/${Date.now()}_${cleanFileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    if (onProgress) onProgress(60);

    // 2. الرفع إلى Supabase Storage
    const { data, error } = await supabase.storage
      .from('medverse_media')
      .upload(filePath, compressedBlob, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    if (onProgress) onProgress(90);

    // 3. الحصول على الرابط العام المباشر للملف
    const { data: publicUrlData } = supabase.storage
      .from('medverse_media')
      .getPublicUrl(filePath);

    if (onProgress) onProgress(100);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Error uploading image via uploadHelper:', err.message || err);
    return null;
  }
};
