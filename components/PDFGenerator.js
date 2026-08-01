import { Platform } from 'react-native';

export const generatePrescriptionPDF = async (patientData, diagnosis, dynamicData, medications = [], clinicInfo = {}) => {
  const currentDate = new Date().toLocaleDateString('ar-EG');
  
  const qrVerificationCode = `VERIFY-${patientData.code || 'PAT'}-${Date.now().toString().slice(-4)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrVerificationCode)}`;

  const medsRows = medications.map(m => `
    <tr>
      <td style="padding: 10px; border: 1px solid #CBD5E1; font-weight: bold; font-family: monospace; text-align: left; direction: ltr;">${m.name}</td>
      <td style="padding: 10px; border: 1px solid #CBD5E1;">${m.dose}</td>
      <td style="padding: 10px; border: 1px solid #CBD5E1;">${m.reason || '---'}</td>
    </tr>
  `).join('');

  const dynamicRows = Object.keys(dynamicData).map(key => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px dashed #E2E8F0; font-weight: bold; width: 35%; color: #334155;">${key}:</td>
      <td style="padding: 8px; border-bottom: 1px dashed #E2E8F0; color: #0F172A;">${dynamicData[key]}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>روشتة طبية معتمدة - ${patientData.name || ''}</title>
      <style>
        /* إخفاء روابط المتصفح ورقم الصفحات والتاريخ عند الطباعة */
        @page {
          size: auto;
          margin: 15mm 15mm 15mm 15mm;
        }

        body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 10px 20px; color: #0F172A; background-color: #FFFFFF; }
        .clinic-header { border-bottom: 3px solid #0F172A; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .clinic-brand { display: flex; align-items: center; gap: 15px; }
        .clinic-logo { width: 75px; height: 75px; object-fit: contain; border-radius: 8px; border: 1px solid #E2E8F0; padding: 2px; }
        .clinic-info h1 { margin: 0; font-size: 24px; font-weight: 900; color: #0F172A; }
        .clinic-info h2 { margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #0284C7; }
        .clinic-info p { margin: 4px 0 0 0; font-size: 13px; color: #64748B; }
        .software-watermark { text-align: left; font-size: 10px; color: #94A3B8; display: flex; flex-direction: column; align-items: flex-end; }
        .patient-box { background: #F8FAFC; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 13px; }
        .patient-box div { margin-bottom: 4px; }
        .section-title { font-size: 15px; font-weight: bold; color: #0F172A; margin-top: 22px; margin-bottom: 8px; border-right: 4px solid #0284C7; padding-right: 8px; }
        .diagnosis-box { background: #FFFFFF; padding: 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 14px; font-weight: bold; min-height: 40px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
        th { background-color: #F1F5F9; color: #1E293B; border: 1px solid #CBD5E1; padding: 8px; text-align: right; }
        .footer { margin-top: 45px; padding-top: 15px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid; }
        .qr-section { text-align: center; }
        .qr-section p { font-size: 9px; color: #94A3B8; margin-top: 4px; }
        .signatures { display: flex; gap: 40px; text-align: center; }
        .sig-box { width: 140px; border-top: 1px dashed #94A3B8; padding-top: 5px; font-size: 12px; font-weight: bold; color: #334155; }

        /* شريط زر الطباعة المباشر بداخل الشاشة */
        .print-bar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #0F172A;
          padding: 12px 24px;
          border-radius: 50px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          display: flex;
          gap: 15px;
          align-items: center;
          z-index: 9999;
        }

        .btn-print {
          background: #059669;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 30px;
          font-weight: bold;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-close {
          background: #475569;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 30px;
          font-size: 13px;
          cursor: pointer;
        }

        /* إخفاء أزرار التحكم تماماً أثناء الطباعة الفعلية */
        @media print {
          .print-bar { display: none !important; }
        }
      </style>
    </head>
    <body>

      <!-- شريط الطباعة العائم بداخل النافذة -->
      <div class="print-bar">
        <button class="btn-print" onclick="window.print()">🖨️ طباعة الروشتة الآن / PDF</button>
        <button class="btn-close" onclick="window.close()">إغلاق ✕</button>
      </div>

      <div class="clinic-header">
        <div class="clinic-brand">
          ${clinicInfo.logoUrl ? `<img src="${clinicInfo.logoUrl}" class="clinic-logo" alt="Logo" />` : ''}
          <div class="clinic-info">
            <h1>${clinicInfo.doctorName || 'د. أحمد محمد'}</h1>
            <h2>${clinicInfo.clinicName || 'عيادة MedVerse التخصصية'}</h2>
            <p>${clinicInfo.specialty || 'استشاري الطب الباطني والتشخيص الذكي'}</p>
          </div>
        </div>
        <div class="software-watermark">
          <span>Powered by</span>
          <strong style="color: #0284C7;">MedVerse Smart EMR Suite</strong>
        </div>
      </div>

      <div class="patient-box">
        <div>
          <div><strong>اسم المريض:</strong> ${patientData.name || '---'}</div>
          <div><strong>رقم الهاتف:</strong> ${patientData.phone || 'غير مسجل'}</div>
        </div>
        <div style="text-align: left;">
          <div><strong>Patient ID:</strong> ${patientData.code || '---'}</div>
          <div><strong>التاريخ:</strong> ${currentDate}</div>
        </div>
      </div>

      <div class="section-title">التشخيص (Diagnosis)</div>
      <div class="diagnosis-box">
        ${diagnosis || 'لم يتم تدوين تشخيص.'}
      </div>

      ${medications.length > 0 ? `
        <div class="section-title">الخطة العلاجية والروشتة (Rx)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 40%;">اسم الدواء (Drug Name)</th>
              <th style="width: 30%;">الجرعة (Dose)</th>
              <th style="width: 30%;">دواعي الاستعمال (Notes)</th>
            </tr>
          </thead>
          <tbody>
            ${medsRows}
          </tbody>
        </table>
      ` : ''}

      ${dynamicRows ? `
        <div class="section-title">تفاصيل الفحوصات والتقرير المخصص</div>
        <table style="border: none;">
          <tbody>
            ${dynamicRows}
          </tbody>
        </table>
      ` : ''}

      <div class="footer">
        <div class="qr-section">
          <img src="${qrCodeUrl}" alt="QR Code" />
          <p>رمز تحقق إلكتروني معتمد</p>
        </div>
        <div class="signatures">
          <div class="sig-box">توقيع: ${clinicInfo.doctorName || 'الطبيب المعالج'}</div>
          <div class="sig-box">ختم العيادة</div>
        </div>
      </div>

    </body>
    </html>
  `;

  try {
    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
      }
    } else {
      const Print = require('expo-print');
      const Sharing = require('expo-sharing');
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    }
  } catch (error) {
    console.error('خطأ في إنتاج ملف الـ PDF:', error);
  }
};
