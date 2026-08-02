import { supabase } from '../supabaseClient'; // تأكد من صحة مسار استيراد سوپابيز

export const uploadMediaFile = async (fileUri, fileName) => {
  try {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const filePath = `uploads/${Date.now()}_${fileName}`;

    const { data, error } = await supabase.storage
      .from('medverse_media')
      .upload(filePath, blob);

    if (error) throw error;

    // الحصول على الرابط العام المباشر للملف
    const { data: publicUrlData } = supabase.storage
      .from('medverse_media')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Error uploading image:', err.message);
    return null;
  }
};
