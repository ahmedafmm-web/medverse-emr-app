import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const generatePrescriptionPDF = async (patientData, diagnosis, dynamicData) => {
  const currentDate = new Date().toLocaleDateString('ar-EG');
  
  const dynamicRows = Object.keys(dynamicData).map(key => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; width: 30%;">${key}:</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${dynamicData[key]}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 25px; color: #1E293B; }
        .header { text-align: center; border-bottom: 2px solid #0F172A; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { color: #0F172A; margin: 0; font-size: 24px; }
        .header p { color: #64748B; margin: 5px 0 0 0; font-size: 14px; }
        .info-box { background: #F8FAFC; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #E2E8F0; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .section-title { font-size: 16px; font-weight: bold; color: #0F172A; margin-top: 15px; margin-bottom: 10px; border-right: 4px solid #0F172A; padding-right: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>MedVerse Medical Center</h1>
        <p>المنظومة الطبية الذكية - روشتة كشف طبي</p>
      </div>

      <div class="info-box">
        <div class="info-row">
          <span><strong>اسم المريض:</strong> ${patientData.name || '---'}</span>
          <span><strong>التاريخ:</strong> ${currentDate}</span>
        </div>
        <div class="info-row">
          <span><strong>رقم الهاتف:</strong> ${patientData.phone || 'غير مسجل'}</span>
          <span><strong>كود المريض:</strong> ${patientData.code || '---'}</span>
        </div>
      </div>

      <div class="section-title">التشخيص الطبي (Diagnosis)</div>
      <p style="background: #FFF; padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px;">
        ${diagnosis || 'لا يوجد تشخيص مدون'}
      </p>

      ${dynamicRows ? `
        <div class="section-title">تفاصيل الكشف المخصص</div>
        <table>
          <tbody>
            ${dynamicRows}
          </tbody>
        </table>
      ` : ''}

      <div class="footer">
        تمت الطباعة بواسطة نظام MedVerse EMR الإلكتروني
      </div>
    </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri);
  } catch (error) {
    console.error('خطأ في إنتاج ملف الـ PDF:', error);
  }
};
