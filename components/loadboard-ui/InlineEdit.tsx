"use client";

/**
 * Inline Edit Component
 *
 * Inline editing panel with dark gray overlay
 * Load Board UI Component Library
 */

import React, { useState } from "react";
import { InlineEditProps } from "@/types/loadboard-ui";
import ActionButton from "./ActionButton";
import CharacterCounter from "./CharacterCounter";

export default function InlineEdit({
  data,
  fields,
  onSave,
  onCancel,
  saving = false,
}: InlineEditProps) {
  const [formData, setFormData] = useState(data);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Handle field change
   */
  const handleChange = (key: string, value: string | number | boolean) => {
    setFormData({ ...formData, [key]: value });
    // Clear error for this field
    if (errors[key]) {
      setErrors({ ...errors, [key]: "" });
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
      console.error("Save failed:", error);
    }
  };

  /**
   * Render field
   */
  const renderField = (field: (typeof fields)[number]) => {
    const value = formData[field.key] || "";
    const error = errors[field.key];

    switch (field.type) {
      case "text":
        return (
          <div>
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[#1e9c99]"
            />
            {field.maxLength && (
              <CharacterCounter value={value} maxLength={field.maxLength} />
            )}
          </div>
        );

      case "number":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[#1e9c99]"
          />
        );

      case "select":
        return (
          <select
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-[#1e9c99]"
          >
            <option value="">Select...</option>
            {field.options?.map((option: { value: string; label: string }) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case "date":
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-[#1e9c99]"
          />
        );

      case "textarea":
        return (
          <div>
            <textarea
              value={value}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              rows={4}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[#1e9c99]"
            />
            {field.maxLength && (
              <CharacterCounter value={value} maxLength={field.maxLength} />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="rounded-lg bg-gray-700 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.key}
            className={field.type === "textarea" ? "md:col-span-2" : ""}
          >
            <label className="mb-1 block text-sm font-medium text-gray-200">
              {field.label}
              {field.required && <span className="ml-1 text-red-400">*</span>}
            </label>
            {renderField(field)}
            {errors[field.key] && (
              <p className="mt-1 text-xs text-red-400">{errors[field.key]}</p>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3 border-t border-gray-600 pt-4">
        <ActionButton
          variant="secondary"
          size="md"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </ActionButton>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
