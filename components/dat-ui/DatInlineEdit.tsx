'use client';

/**
 * DAT Inline Edit Component
 *
 * Inline editing panel with dark gray overlay
 * Sprint 14 - DAT-Style UI Transformation
 */

import React, { useState } from 'react';
import { DatInlineEditProps } from '@/types/dat-ui';
import DatActionButton from './DatActionButton';
import DatCharacterCounter from './DatCharacterCounter';

export default function DatInlineEdit({
  data,
  fields,
  onSave,
  onCancel,
  saving = false,
}: DatInlineEditProps) {
  const [formData, setFormData] = useState(data);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Handle field change
   */
  const handleChange = (key: string, value: any) => {
    setFormData({ ...formData, [key]: value });
    // Clear error for this field
    if (errors[key]) {
      setErrors({ ...errors, [key]: '' });
    }
  };

  /**
   * Validate form
   */
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      if (field.required && !formData[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle save
   */
  const handleSave = async () => {
    if (!validate()) return;

    try {
      await onSave(formData);
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  /**
   * Render field
   */
  const renderField = (field: any) => {
    const value = formData[field.key] || '';
    const error = errors[field.key];

    switch (field.type) {
      case 'text':
        return (
          <div>
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-[#1e9c99] focus:border-transparent"
            />
            {field.maxLength && (
              <DatCharacterCounter value={value} maxLength={field.maxLength} />
            )}
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-[#1e9c99] focus:border-transparent"
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-[#1e9c99] focus:border-transparent"
          >
            <option value="">Select...</option>
            {field.options?.map((option: any) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-[#1e9c99] focus:border-transparent"
          />
        );

      case 'textarea':
        return (
          <div>
            <textarea
              value={value}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              rows={4}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-[#1e9c99] focus:border-transparent"
            />
            {field.maxLength && (
              <DatCharacterCounter value={value} maxLength={field.maxLength} />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div
            key={field.key}
            className={field.type === 'textarea' ? 'md:col-span-2' : ''}
          >
            <label className="block text-sm font-medium text-gray-200 mb-1">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {renderField(field)}
            {errors[field.key] && (
              <p className="text-red-400 text-xs mt-1">{errors[field.key]}</p>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-600">
        <DatActionButton
          variant="secondary"
          size="md"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </DatActionButton>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
