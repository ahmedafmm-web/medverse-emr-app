import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ljtserbmtfmqzdsxszbb.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqdHNlcmJtdGZtcXpkc3hzemJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjE0ODEsImV4cCI6MjEwMDkzNzQ4MX0.18_yD8XvUFZY71mqm-Rw3-fl102yFVdFcoOJEl-clGo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// دالة رفع الصور والأشعة لـ Supabase Storage
export const uploadMediaFile = async (fileUri, fileName) => {
  try {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const filePath = `uploads/${Date.now()}_${fileName}`;

    const { data, error } = await supabase.storage
      .from('medverse_media')
      .upload(filePath, blob);

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('medverse_media')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Error uploading image:', err.message);
    return null;
  }
};
