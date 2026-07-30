import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function DynamicFormBuilder({ schema, formData, onChange }) {
  if (!schema || schema.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>لا توجد حقول مخصصة لهذا التخصص.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {schema.map((field) => (
        <View key={field.key} style={styles.fieldGroup}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            style={[styles.input, field.type === 'textarea' && styles.textArea]}
            placeholder={field.placeholder || ''}
            placeholderTextColor="#94A3B8"
            value={formData[field.key] || ''}
            onChangeText={(text) => onChange(field.key, text)}
            multiline={field.type === 'textarea'}
            numberOfLines={field.type === 'textarea' ? 4 : 1}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10 },
  emptyContainer: { padding: 15, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 14 },
  fieldGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 6, color: '#0F172A', textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    textAlign: 'right',
    color: '#1E293B'
  },
  textArea: { height: 90, textAlignVertical: 'top' }
});
