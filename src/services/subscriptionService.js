import { supabase } from '../../supabaseClient';
import { Platform } from 'react-native';

const SUB_CACHE_KEY = 'MEDVERSE_SUB_STATUS';

const saveLocalStatus = async (status) => {
  try {
    const data = JSON.stringify(status);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(SUB_CACHE_KEY, data);
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem(SUB_CACHE_KEY, data);
    }
  } catch (e) {
    console.error('Error saving sub cache:', e);
  }
};

export const getLocalSubStatus = async () => {
  try {
    let data = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      data = window.localStorage.getItem(SUB_CACHE_KEY);
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      data = await AsyncStorage.getItem(SUB_CACHE_KEY);
    }
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
};

export const verifyDoctorAccess = async (user) => {
  try {
    if (!user || !user.email) {
      return { allowed: false, message: 'يرجى تسجيل الدخول أولاً.' };
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('email', user.email)
      .single();

    const now = new Date();

    if (!data) {
      const { data: newSub, error: insertError } = await supabase
        .from('subscriptions')
        .insert([{
          user_id: user.id,
          email: user.email,
          plan_type: 'trial',
          status: 'active',
          has_used_trial: true,
          ends_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      const result = { allowed: true, daysLeft: 3, message: 'مرحباً بك في فترتك التجريبية (3 أيام)' };
      await saveLocalStatus(result);
      return result;
    }

    if (data.status === 'disabled') {
      const result = { allowed: false, isDisabled: true, message: 'تم تعطيل هذا الحساب، يرجى التواصل مع الدعم الفني.' };
      await saveLocalStatus(result);
      return result;
    }

    const expiryDate = new Date(data.ends_at);

    if (expiryDate <= now || data.status === 'expired') {
      await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('email', user.email);

      const result = { 
        allowed: false, 
        isExpiredTrial: true,
        message: 'استنفذت مرحلتك التجريبيه بالفعل. يرجى الدفع والتواصل مع الدعم لتفعيل اشتراكك.' 
      };
      await saveLocalStatus(result);
      return result;
    }

    const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    const result = { 
      allowed: true, 
      daysLeft, 
      showAlert: daysLeft <= 3,
      message: daysLeft <= 3 ? `تنبيه: متبقي على انتهاء اشتراكك ${daysLeft} أيام!` : 'الاشتراك ساري' 
    };
    await saveLocalStatus(result);
    return result;

  } catch (err) {
    console.error('Subscription verification error:', err.message);
    const cached = await getLocalSubStatus();
    if (cached) return cached;
    return { allowed: false, message: 'حدث خطأ أثناء التحقق من حالة الاشتراك.' };
  }
};
 
