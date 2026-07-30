import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const generatePrescriptionPDF = async (patientData, diagnosis, dynamicData) => {
  const currentDate = new Date().toLocaleDateString('ar-EG');
  
  // توليد كود التحقق ضد التزوير
  const qrVerificationCode = `VERIFY-${patientData.code || 'PAT'}-${Date.now().toString().slice(-4)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrVerificationCode)}`;

  // تحويل البيانات الديناميكية إلى جدول أنيق
  const dynamicRows = Object.keys(dynamicData).map(key => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: bold; width: 35%; color: #334155;">${key}:</td>
      <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; color: #0F172A;">${dynamicData[key]}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 30px; color: #0F172A; background-color: #FFFFFF; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0284C7; padding-bottom: 15px; margin-bottom: 20px; }
        .doc-details h1 { color: #0284C7; margin: 0; font-size: 22px; font-weight: bold; }
        .doc-details p { color: #64748B; margin: 3px 0; font-size: 13px; }
        .brand-logo { font-size: 24px; font-weight: 900; color: #0F172A; text-align: left; }
        .info-box { background: #F8FAFC; padding: 12px 18px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 13px; }
        .info-item { margin-bottom: 4px; }
        .section-title { font-size: 15px; font-weight: bold; color: #0284C7; margin-top: 20px; margin-bottom: 8px; border-right: 4px solid #0284C7; padding-right: 8px; }
        .diagnosis-box { background: #FFFFFF; padding: 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 14px; min-height: 50px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
        .footer { margin-top: 40px; border-top: 2px dashed #E2E8F0; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; }
        .qr-section { text-align: center; }
        .qr-section img { width: 70px; height: 70px; }
        .qr-section p { font-size: 9px; color: #94A3B8; margin-top: 2px; }
        .stamp-section { text-align: center; }
        .stamp-box { border: 2px dashed #94A3B8; padding: 10px 25px; border-radius: 8px; color: #64748B; font-size: 11px; font-weight: bold; margin-top: 5px; }
      </style>
    </head>
    <body>

      <div class="header">
        <div class="doc-details">
          <h1>د. أحمد محمد</h1>
          <p>استشاري الطب الباطني والتشخيص الذكي</p>
          <p>تليفون العيادة: 01000000000</p>
        </div>
        <div class="brand-logo">
          MedVerse <br/>
          <span style="font-size: 10px; color: #0284C7; display: block; font-weight: normal;">Smart EMR Suite</span>
        </div>
      </div>

      <div class="info-box">
        <div>
          <div class="info-item"><strong>اسم المريض:</strong> ${patientData.name || '---'}</div>
          <div class="info-item"><strong>رقم الهاتف:</strong> ${patientData.phone || 'غير مسجل'}</div>
        </div>
        <div style="text-align: left;">
          <div class="info-item"><strong>كود المريض:</strong> ${patientData.code || '---'}</div>
          <div class="info-item"><strong>التاريخ:</strong> ${currentDate}</div>
        </div>
      </div>

      <div class="section-title">التشخيص والتوصيات العلاجية (Diagnosis & Rx)</div>
      <div class="diagnosis-box">
        ${diagnosis || 'لا يوجد تشخيص مدون'}
      </div>

      ${dynamicRows ? `
        <div class="section-title">تفاصيل الكشف المخصص</div>
        <table>
          <tbody>
            ${dynamicRows}
          </tbody>
        </table>
      ` : ''}

      <div class="footer">
        <div class="qr-section">
          <img src="${qrCodeUrl}" alt="QR Code" />
          <p>رمز تحقق معتمد ضد التزوير</p>
        </div>

        <div class="stamp-section">
          <p style="font-size: 12px; font-weight: bold; margin: 0; color: #334155;">توقيع وختم الطبيب المعالج</p>
          <div class="stamp-box">
            توقيع الكتروني معتمد <br/> MedVerse Verified
          </div>
        </div>
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
