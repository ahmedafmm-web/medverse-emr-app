import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform, Linking } from 'react-native';

export default function PrivacyPolicy({ onBack }) {
  const handleContactSupport = () => {
    const message = 'مرحباً، لدي استفسار بخصوص سياسة الخصوصية وشروط الاستخدام في تطبيق MedVerse.';
    const url = `https://wa.me/201127834972?text=${encodeURIComponent(message)}`;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>← العودة للتطبيق</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.mainTitle}>سياسة الخصوصية وشروط الاستخدام 🛡️</Text>
        <Text style={styles.updateDate}>آخر تحديث: أغسطس 2026</Text>

        <Text style={styles.introText}>
          أهلاً بك في منصة <Text style={styles.highlight}>MedVerse EMR Suite</Text>. نحن نلتزم بأعلى معايير الخصوصية والأمان لحماية بيانات الأطباء والعيادات والمرضى، وتوفير بيئة رقمية آمنة وفق أحدث السياسات البرمجية والأمنية.
        </Text>

        <View style={styles.divider} />

        {/* Section 1 */}
        <Text style={styles.sectionHeader}>1. البيانات التي نجمعها وكيفية استخدامها 📂</Text>
        <Text style={styles.paragraph}>
          • <Text style={styles.boldText}>بيانات الأطباء والعيادات:</Text> تشمل البريد الإلكتروني، اسم الطبيب، التخصص، ورقم الهاتف المخصص للعيادة لتنظيم ملف الحساب والاشتراكات.
        </Text>
        <Text style={styles.paragraph}>
          • <Text style={styles.boldText}>بيانات المرضى والسجلات الطبية:</Text> تشمل اسم المريض، السن، الهاتف، التشخيصات، الروشتات، وصور الأشعة المرفوعة. يتم تخزين هذه البيانات في قواعد بيانات سحابية مشفرة وتُستخدم فقط لغرض العرض والمتابعة الإكلينيكية.
        </Text>

        {/* Section 2 */}
        <Text style={styles.sectionHeader}>2. حماية البيانات وأمان التخزين (RLS Security) 🔐</Text>
        <Text style={styles.paragraph}>
          • يتم تطبيق سياسات حماية صارمة على مستوى الأسطر <Text style={styles.boldText}>(Row Level Security - RLS)</Text> وقواعد التخزين السحابي.
        </Text>
        <Text style={styles.paragraph}>
          • يُعزل حساب كل طبيب بالكامل؛ ولا يحق لأي طرف أو طبيب آخر الاطلاع على بيانات عيادتك أو مرضالك.
        </Text>
        <Text style={styles.paragraph}>
          • يستطيع المريض الوصول حصرياً لتقاريره وأشعاته المعتمدة من خلال كود المريض الفريد <Text style={styles.boldText}>(Patient ID)</Text> دون أي صلاحية للتعديل أو الحذف.
        </Text>

        {/* Section 3 */}
        <Text style={styles.sectionHeader}>3. إخلاء مسؤولية الذكاء الاصطناعي الإكلينيكي 🩺✨</Text>
        <Text style={styles.warningBoxText}>
          ⚠️ <Text style={styles.boldText}>تنبيه هام للأطباء:</Text> المساعد الذكي المدمج في المنظومة (LLaMA AI) يعمل كـ <Text style={styles.boldText}>"أداة استرشادية مساعدة فقط"</Text> لتحليل الأعراض واقتراح دواعي الاستعمال والتفاعلات الدوائية. القرار الطبي والتشخيص النهائي والروشتة المعتمدة هي مسؤولية الطبيب المعالج فقط ووفق تقديره الإكلينيكي المباشر.
        </Text>

        {/* Section 4 */}
        <Text style={styles.sectionHeader}>4. مشاركة البيانات مع أطراف خارجية 🚫</Text>
        <Text style={styles.paragraph}>
          نحن لا نبيع ولا نشارك أي بيانات طبية أو شخصية مع أي جهات إعلانية أو أطراف خارجية. تُستخدم السحابة فقط لتشغيل وظائف المنظومة وتخزين الصور بجودة فائقة.
        </Text>

        {/* Section 5 */}
        <Text style={styles.sectionHeader}>5. الاشتراكات والمدفوعات 💳</Text>
        <Text style={styles.paragraph}>
          تخضع اشتراكات التطبيق للخطط الشهرية أو السنوية المحددة. يتم تفعيل الاشتراك فور تأكيد التحويل. وفي حال انتهاء الاشتراك، تظل بيانات العيادة محفوظة بأمان لحين التجديد دون إتلافها.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.contactTitle}>هل لديك أي استفسار قانوني أو تقني؟</Text>
        <TouchableOpacity style={styles.contactBtn} onPress={handleContactSupport}>
          <Text style={styles.contactBtnText}>💬 التواصل مع الدعم الفني عبر الواتساب</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D16', padding: 14 },
  card: { backgroundColor: '#131C2E', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 30 },
  backBtn: { marginBottom: 15, alignSelf: 'flex-start' },
  backBtnText: { color: '#00F2FE', fontSize: 13, fontWeight: 'bold' },
  mainTitle: { fontSize: 20, fontWeight: '900', color: '#00F2FE', textAlign: 'right', marginBottom: 4 },
  updateDate: { fontSize: 11, color: '#64748B', textAlign: 'right', marginBottom: 15 },
  introText: { fontSize: 13, color: '#CBD5E1', textAlign: 'right', lineHeight: 22, marginBottom: 15 },
  divider: { height: 1, backgroundColor: '#1E293B', marginVertical: 15 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#38BDF8', marginTop: 10, marginBottom: 8, textAlign: 'right' },
  paragraph: { fontSize: 12, color: '#94A3B8', textAlign: 'right', lineHeight: 20, marginBottom: 8 },
  boldText: { color: '#FFFFFF', fontWeight: 'bold' },
  highlight: { color: '#00F2FE', fontWeight: 'bold' },
  warningBoxText: { backgroundColor: 'rgba(234, 179, 8, 0.12)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#EAB308', color: '#FDE047', fontSize: 12, textAlign: 'right', lineHeight: 20, marginVertical: 10 },
  contactTitle: { fontSize: 13, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center', marginTop: 10, marginBottom: 10 },
  contactBtn: { backgroundColor: '#16A34A', padding: 12, borderRadius: 10, alignItems: 'center' },
  contactBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }
});
