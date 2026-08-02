import { supabase } from '../supabaseClient';

export const verifyDoctorAccess = async (user) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('email', user.email)
      .single();

    const now = new Date();

    // 1. لو الإيميل مش موجود خالص (أول مرة يسجل) -> يمنح 3 أيام تجربة
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
      return { allowed: true, daysLeft: 3, message: 'مرحباً بك في فترتك التجريبية (3 أيام)' };
    }

    // 2. لو الحساب معطل من الأدمن
    if (data.status === 'disabled') {
      return { allowed: false, isDisabled: true, message: 'تم تعطيل هذا الحساب، يرجى التواصل مع الدعم الفني.' };
    }

    const expiryDate = new Date(data.ends_at);

    // 3. لو الاشتراك انتهى أو انتهت الفترة التجريبية
    if (expiryDate <= now || data.status === 'expired') {
      await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('email', user.email);

      return { 
        allowed: false, 
        isExpiredTrial: true,
        message: 'استنفذت مرحلتك التجريبيه بالفعل. يرجى الدفع والتواصل مع الدعم لتفعيل اشتراكك.' 
      };
    }

    // 4. حساب الأيام المتبقية والتنبيه قبل الانتهاء بـ 3 أيام
    const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    
    return { 
      allowed: true, 
      daysLeft, 
      showAlert: daysLeft <= 3,
      message: daysLeft <= 3 ? `تنبيه: متبقي على انتهاء اشتراكك ${daysLeft} أيام!` : 'الاشتراك ساري' 
    };

  } catch (err) {
    console.error('Subscription verification error:', err.message);
    return { allowed: false, message: 'حدث خطأ أثناء التحقق من حالة الاشتراك.' };
  }
};
