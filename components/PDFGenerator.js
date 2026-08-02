import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const generatePrescriptionPDF = async (patient = {}, diagnosis = '', details = {}, medications = [], clinicInfo = {}) => {
  const currentDate = new Date().toLocaleDateString('ar-EG');

  const medsRows = medications && medications.length > 0
    ? medications.map((med) => `
        <tr>
          <td style="width: 35%; text-align: right; padding: 10px 8px; border-bottom: 1px solid #E2E8F0; vertical-align: top;">
            <strong style="color: #0F172A; font-size: 12px; display: block;">${med.name || ''}</strong>
          </td>
          <td style="width: 30%; text-align: right; padding: 10px 8px; border-bottom: 1px solid #E2E8F0; color: #334155; font-size: 11px; vertical-align: top;">
            ${med.dose || 'حسب التوجيهات'}
          </td>
          <td style="width: 35%; text-align: right; padding: 10px 8px; border-bottom: 1px solid #E2E8F0; color: #475569; font-size: 11px; vertical-align: top;">
            ${med.reason || 'لا يوجد'}
          </td>
        </tr>
      `).join('')
    : `<tr><td colspan="3" style="text-align: center; padding: 15px; color: #64748B;">لا يوجد أدوية مسجلة</td></tr>`;

  const detailsRows = details && Object.keys(details).length > 0
    ? Object.entries(details).map(([key, val]) => `
        <div style="margin-bottom: 6px; font-size: 11px;">
          <strong style="color: #0284C7;">${key}:</strong> 
          <span style="color: #334155;">${val || 'لا يوجد'}</span>
        </div>
      `).join('')
    : '<div style="font-size: 11px; color: #64748B;">لا توجد تفاصيل إضافية</div>';

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 15mm; }
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          margin: 0; padding: 0; color: #0F172A; background-color: #FFFFFF;
          -webkit-print-color-adjust: exact;
        }
        .header {
          display: flex; justify-content: space-between; align-items: center;
          border-bottom: 2px solid #0284C7; padding-bottom: 12px; margin-bottom: 15px;
        }
        .clinic-info { text-align: right; }
        .clinic-name { font-size: 18px; font-weight: bold; color: #0284C7; }
        .doctor-name { font-size: 14px; font-weight: bold; color: #1E293B; margin-top: 3px; }
        .specialty { font-size: 11px; color: #64748B; }
        .contact-info { font-size: 10px; color: #475569; margin-top: 4px; }
        
        .patient-box {
          background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px;
          padding: 10px 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;
        }
        .patient-detail { font-size: 12px; color: #334155; }
        
        .section-title {
          font-size: 13px; font-weight: bold; color: #0284C7;
          border-right: 4px solid #0284C7; padding-right: 8px; margin-top: 12px; margin-bottom: 8px;
        }
        
        .diagnosis-box {
          background-color: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 6px;
          padding: 8px 12px; font-size: 12px; font-weight: bold; color: #0369A1; margin-bottom: 12px;
        }
        
        table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 20px; table-layout: fixed; }
        th { background-color: #F1F5F9; color: #475569; font-size: 11px; padding: 8px; text-align: right; border-bottom: 2px solid #CBD5E1; }
        
        .footer {
          margin-top: 30px; padding-top: 12px; border-top: 1px solid #E2E8F0;
          display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #94A3B8;
        }
        .qr-placeholder {
          font-size: 10px; color: #0284C7; font-weight: bold;
          border: 1px dashed #0284C7; padding: 4px 8px; border-radius: 4px;
        }
        .stamp-box {
          text-align: center; width: 140px;
        }
        .stamp-img {
          max-height: 65px; width: auto; max-width: 130px; display: block; margin: 0 auto 4px auto;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="clinic-info">
          <div class="clinic-name">${clinicInfo.clinicName || 'عيادة MedVerse التخصصية'}</div>
          <div class="doctor-name">${clinicInfo.doctorName || 'د. أحمد محمد'}</div>
          <div class="specialty">${clinicInfo.specialty || ''}</div>
          ${(clinicInfo.phone || clinicInfo.address) ? `
            <div class="contact-info">
              ${clinicInfo.phone ? `<span>📞 ${clinicInfo.phone}</span>` : ''} 
              ${clinicInfo.address ? `<span style="margin-right: 10px;">📍 ${clinicInfo.address}</span>` : ''}
            </div>
          ` : ''}
        </div>
        ${clinicInfo.logoUrl ? `<img src="${clinicInfo.logoUrl}" style="height: 50px; width: auto; max-width: 120px;" />` : ''}
      </div>

      <div class="patient-box">
        <div>
          <span class="patient-detail"><strong>اسم المريض:</strong> ${patient.name || ''}</span>
          ${patient.phone ? `<span class="patient-detail" style="margin-right: 12px;">| <strong>الهاتف:</strong> ${patient.phone}</span>` : ''}
        </div>
        <div>
          <span class="patient-detail"><strong>Patient ID:</strong> ${patient.code || ''}</span>
          <span class="patient-detail" style="margin-right: 12px;">| <strong>التاريخ:</strong> ${currentDate}</span>
        </div>
      </div>

      <div class="section-title">تفاصيل الفحوصات والتقرير المخصص</div>
      <div style="background-color: #FAF5FF; border: 1px solid #F3E8FF; padding: 10px; border-radius: 6px; margin-bottom: 12px;">
        ${detailsRows}
      </div>

      <div class="section-title">التشخيص (Diagnosis)</div>
      <div class="diagnosis-box">
        🩺 ${diagnosis || 'لم يتم تحديد تشخيص'}
      </div>

      <div class="section-title">الخطة العلاجية والروشتة (Rx)</div>
      <table>
        <thead>
          <tr>
            <th style="width: 35%;">اسم الدواء (Drug Name)</th>
            <th style="width: 30%;">الجرعة (Dose)</th>
            <th style="width: 35%;">دواعي الاستعمال / ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${medsRows}
        </tbody>
      </table>

      <div class="footer">
        <div><span>Powered by <strong>MedVerse Smart EMR Suite</strong></span></div>
        <div class="qr-placeholder">🔒 رمز تحقق إلكتروني معتمد: VERIFY-${patient.code || ''}</div>
        <div class="stamp-box">
          ${clinicInfo.stampUrl ? `<img src="${clinicInfo.stampUrl}" class="stamp-img" />` : ''}
          <div style="font-size: 11px; font-weight: bold; color: #334155;">توقيع وختم الطبيب</div>
          <div style="font-size: 10px; color: #64748B;">${clinicInfo.doctorName || ''}</div>
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
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        await Print.printAsync({ html: htmlContent });
      }
    } else {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    }
  } catch (error) {
    console.error("PDF Generation Error:", error);
  }
};
 
