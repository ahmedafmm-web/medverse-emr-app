import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';

export default function DynamicFormBuilder({ schema, formData, onChange, onUpdateSchema, presets, onSelectPreset }) {
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('input');
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);

  const checkSafetyAlerts = (text) => {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    
    const hasAspirin = lowerText.includes('aspirin') || lowerText.includes('اسبرين') || lowerText.includes('أسبرين');
    const hasWarfarin = lowerText.includes('warfarin') || lowerText.includes('وارفارين');
    if (hasAspirin && hasWarfarin) {
      return '⚠️ تحذير طبي: تعارض خطير بين Aspirin و Warfarin يزيد من خطر النزيف!';
    }

    const hasPanadol = lowerText.includes('panadol') || lowerText.includes('بنادول');
    const hasParacetamol = lowerText.includes('paracetamol') || lowerText.includes('باراسيتامول');
    if (hasPanadol && hasParacetamol) {
      return '⚠️ تنبيه: تكرار نفس المادة الفعالة (Paracetamol) قد يسبب زيادة عن الجرعة الآمنة!';
    }
    return null;
  };

  const showAlert = (title, message) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleAddField = () => {
    if (!newFieldLabel.trim()) {
      showAlert('تنبيه', 'يرجى إدخال اسم الحقل الجديد.');
      return;
    }
    const newKey = 'custom_' + Date.now();
    const updatedSchema = [
      ...(schema || []),
      { key: newKey, label: newFieldLabel.trim(), type: newFieldType, placeholder: '' }
    ];
    if (onUpdateSchema) onUpdateSchema(updatedSchema);
    setNewFieldLabel('');
    setShowAddFieldModal(false);
  };

  const handleRemoveField = (keyToRemove) => {
    const updatedSchema = (schema || []).filter(field => field.key !== keyToRemove);
    if (onUpdateSchema) onUpdateSchema(updatedSchema);
  };

  return (
    <View style={styles.container}>
      {presets && presets.length > 0 && (
        <View style={styles.presetsContainer}>
          <Text style={styles.presetsTitle}>⚡ القوالب التشخيصية السريعة:</Text>
          <View style={styles.presetButtonsRow}>
            {presets.map((preset, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={styles.presetChip}
                onPress={() => onSelectPreset && onSelectPreset(preset)}
              >
                <Text style={styles.presetChipText}>{preset.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {schema && schema.length > 0 ? (
        schema.map((field) => {
          const alertMessage = checkSafetyAlerts(formData ? formData[field.key] : '');

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
                placeholderTextColor="#64748B"
                value={(formData && formData[field.key]) || ''}
                onChangeText={(text) => onChange && onChange(field.key, text)}
                multiline={field.type === 'textarea'}
                numberOfLines={field.type === 'textarea' ? 3 : 1}
              />

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
            placeholderTextColor="#64748B"
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
  presetsContainer: { marginBottom: 15, backgroundColor: '#090D16', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#1E293B' },
  presetsTitle: { fontSize: 12, fontWeight: 'bold', color: '#00F2FE', marginBottom: 8, textAlign: 'right' },
  presetButtonsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  presetChip: { backgroundColor: '#0284C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  presetChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  emptyContainer: { padding: 15, alignItems: 'center' },
  emptyText: { color: '#64748B', fontSize: 13 },
  fieldGroup: { marginBottom: 15 },
  labelHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#F8FAFC', textAlign: 'right' },
  removeText: { fontSize: 11, color: '#EF4444', fontWeight: 'bold' },
  input: {
    borderWidth: 1, borderColor: '#1E293B', borderRadius: 8, padding: 11,
    backgroundColor: '#090D16', fontSize: 13, textAlign: 'right', color: '#FFFFFF'
  },
  textArea: { height: 75, textAlignVertical: 'top' },
  inputAlertBorder: { borderColor: '#EF4444', borderWidth: 1.5, backgroundColor: 'rgba(153, 27, 27, 0.2)' },
  alertBox: { marginTop: 5, backgroundColor: 'rgba(153, 27, 27, 0.4)', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#EF4444' },
  alertText: { color: '#FCA5A5', fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  addFieldBtn: { borderWidth: 1, borderColor: '#0284C7', borderStyle: 'dashed', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  addFieldBtnText: { color: '#00F2FE', fontSize: 13, fontWeight: 'bold' },
  addModalCard: { backgroundColor: '#131C2E', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1E293B', marginTop: 10 },
  addModalTitle: { fontSize: 13, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 10, textAlign: 'right' },
  typeSelectorRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 12 },
  typeBtn: { flex: 1, padding: 8, borderWidth: 1, borderColor: '#1E293B', borderRadius: 6, alignItems: 'center', backgroundColor: '#090D16' },
  typeBtnActive: { backgroundColor: '#0284C7', borderColor: '#00F2FE' },
  typeBtnText: { fontSize: 12, color: '#94A3B8' },
  typeBtnTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  modalActionsRow: { flexDirection: 'row-reverse', gap: 8 },
  saveFieldBtn: { flex: 1, backgroundColor: '#10B981', padding: 10, borderRadius: 6, alignItems: 'center' },
  saveFieldBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  cancelFieldBtn: { padding: 10, borderRadius: 6, alignItems: 'center' },
  cancelFieldBtnText: { color: '#94A3B8', fontSize: 12 }
});
 
