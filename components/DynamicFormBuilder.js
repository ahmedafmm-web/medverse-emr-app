import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';

export default function DynamicFormBuilder({ schema, formData, onChange, onUpdateSchema, presets, onSelectPreset }) {
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('input');
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);

  // 🛡️ قاعدة بيانات مبسطة لفحص التعارضات والجرعات للـ Safety Check Engine
  const checkSafetyAlerts = (text) => {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    
    // مثال لفحص التفاعلات الدوائية الخطرة
    if (lowerText.includes('aspirin') && lowerText.includes('warfarin')) {
      return '⚠️ تحذير طبي: تعارض خطير بين Aspirin و Warfarin يزيد من خطر النزيف!';
    }
    if (lowerText.includes('panadol') && lowerText.includes('paracetamol')) {
      return '⚠️ تنبيه: تكرار نفس المادة الفعالة (Paracetamol) قد يسبب زيادة عن الجرعة الآمنة!';
    }
    return null;
  };

  const handleAddField = () => {
    if (!newFieldLabel.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم الحقل الجديد.');
      return;
    }
    const newKey = 'custom_' + Date.now();
    const updatedSchema = [
      ...schema,
      { key: newKey, label: newFieldLabel.trim(), type: newFieldType, placeholder: '' }
    ];
    onUpdateSchema(updatedSchema);
    setNewFieldLabel('');
    setShowAddFieldModal(false);
  };

  const handleRemoveField = (keyToRemove) => {
    const updatedSchema = schema.filter(field => field.key !== keyToRemove);
    onUpdateSchema(updatedSchema);
  };

  return (
    <View style={styles.container}>
      
      {/* ⚡ 1. شريط القوالب السريعة (Presets Toolbar) */}
      {presets && presets.length > 0 && (
        <View style={styles.presetsContainer}>
          <Text style={styles.presetsTitle}>⚡ القوالب التشخيصية السريعة:</Text>
          <View style={styles.presetButtonsRow}>
            {presets.map((preset, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={styles.presetChip}
                onPress={() => onSelectPreset(preset)}
              >
                <Text style={styles.presetChipText}>{preset.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 📋 2. الحقول Dynamic الخاصة بالتخصص */}
      {schema && schema.length > 0 ? (
        schema.map((field) => {
          const alertMessage = checkSafetyAlerts(formData[field.key]);

          return (
            <View key={field.key} style={styles.fieldGroup}>
              <View style={styles.labelHeader}>
                <TouchableOpacity onPress={() => handleRemoveField(field.key)}>
                  <Text style={styles.removeText}>✕ حذف</Text>
                </TouchableOpacity>
                <Text style={styles.label}>{field.label}</Text>
              </View>

              <TextInput
                style={[
                  styles.input, 
                  field.type === 'textarea' && styles.textArea,
                  alertMessage && styles.inputAlertBorder
                ]}
                placeholder={field.placeholder || 'أدخل التفاصيل...'}
                placeholderTextColor="#94A3B8"
                value={formData[field.key] || ''}
                onChangeText={(text) => onChange(field.key, text)}
                multiline={field.type === 'textarea'}
                numberOfLines={field.type === 'textarea' ? 3 : 1}
              />

              {/* 🚨 3. محرك الحماية والتنبيه باللون الأحمر */}
              {alertMessage && (
                <View style={styles.alertBox}>
                  <Text style={styles.alertText}>{alertMessage}</Text>
                </View>
              )}
            </View>
          );
        })
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>لا توجد حقول مخصصة حالياً.</Text>
        </View>
      )}

      {/* ➕ 4. زر إضافة حقل مخصص جديد من قبل الطبيب */}
      {!showAddFieldModal ? (
        <TouchableOpacity 
          style={styles.addFieldBtn}
          onPress={() => setShowAddFieldModal(true)}
        >
          <Text style={styles.addFieldBtnText}>+ إضافة عنصر/حقل جديد للتخصص</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.addModalCard}>
          <Text style={styles.addModalTitle}>إضافة حقل جديد للقائمة</Text>
          <TextInput
            style={styles.input}
            placeholder="اسم الحقل (مثال: الفحوصات المطلوبة)"
            placeholderTextColor="#94A3B8"
            value={newFieldLabel}
            onChangeText={setNewFieldLabel}
          />
          <View style={styles.typeSelectorRow}>
            <TouchableOpacity 
              style={[styles.typeBtn, newFieldType === 'input' && styles.typeBtnActive]}
              onPress={() => setNewFieldType('input')}
            >
              <Text style={[styles.typeBtnText, newFieldType === 'input' && styles.typeBtnTextActive]}>سطر واحد</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.typeBtn, newFieldType === 'textarea' && styles.typeBtnActive]}
              onPress={() => setNewFieldType('textarea')}
            >
              <Text style={[styles.typeBtnText, newFieldType === 'textarea' && styles.typeBtnTextActive]}>نص مطول</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalActionsRow}>
            <TouchableOpacity style={styles.saveFieldBtn} onPress={handleAddField}>
              <Text style={styles.saveFieldBtnText}>حفظ الحقل</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelFieldBtn} onPress={() => setShowAddFieldModal(false)}>
              <Text style={styles.cancelFieldBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10 },
  presetsContainer: { marginBottom: 15, backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8 },
  presetsTitle: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 8, textAlign: 'right' },
  presetButtonsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  presetChip: { backgroundColor: '#0284C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  presetChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  emptyContainer: { padding: 15, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 13 },
  fieldGroup: { marginBottom: 15 },
  labelHeader: { flexDirection: 'row', justifySpaceBetween: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#0F172A', textAlign: 'right' },
  removeText: { fontSize: 11, color: '#EF4444', fontWeight: 'bold' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 11,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    textAlign: 'right',
    color: '#1E293B'
  },
  textArea: { height: 75, textAlignVertical: 'top' },
  inputAlertBorder: { borderColor: '#EF4444', borderWidth: 1.5, backgroundColor: '#FEF2F2' },
  alertBox: { marginTop: 5, backgroundColor: '#FEE2E2', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5' },
  alertText: { color: '#991B1B', fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  addFieldBtn: { borderWidth: 1, borderColor: '#0284C7', borderStyle: 'dashed', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  addFieldBtnText: { color: '#0284C7', fontSize: 13, fontWeight: 'bold' },
  addModalCard: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 10 },
  addModalTitle: { fontSize: 13, fontWeight: 'bold', color: '#0F172A', marginBottom: 10, textAlign: 'right' },
  typeSelectorRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 12 },
  typeBtn: { flex: 1, padding: 8, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  typeBtnText: { fontSize: 12, color: '#475569' },
  typeBtnTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  modalActionsRow: { flexDirection: 'row-reverse', gap: 8 },
  saveFieldBtn: { flex: 1, backgroundColor: '#10B981', padding: 10, borderRadius: 6, alignItems: 'center' },
  saveFieldBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  cancelFieldBtn: { padding: 10, borderRadius: 6, alignItems: 'center' },
  cancelFieldBtnText: { color: '#64748B', fontSize: 12 }
});
