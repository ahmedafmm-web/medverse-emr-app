import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ljtserbmtfmqzdsxszbb.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqdHNlcmJtdGZtcXpkc3hzemJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjE0ODEsImV4cCI6MjEwMDkzNzQ4MX0.18_yD8XvUFZY71mqm-Rw3-fl102yFVdFcoOJEl-clGo';

// استخدام التخزين المناسب حسب البيئة لتفادي أي Crash
const customStorage = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    }
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/**
 * دالة رفع الصور والأشعات والمستندات الطبية لـ Supabase Storage
 */
export const uploadMediaFile = async (fileInput, fileName, bucketName = 'clinic-assets') => {
  try {
    let blob = fileInput;

    // إذا كان الممرر رابط URI كـ String في الموبايل أو الويب، نحوله لـ Blob
    if (typeof fileInput === 'string') {
      const response = await fetch(fileInput);
      blob = await response.blob();
    }

    const cleanFileName = fileName ? fileName.replace(/[^a-zA-Z0-9._-]/g, '_') : 'file';
    const filePath = `uploads/${Date.now()}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, {
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      console.error('Supabase Storage Upload Error:', error.message);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Error uploading image/file:', err.message);
    return null;
  }
};
