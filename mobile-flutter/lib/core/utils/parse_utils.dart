// Shared parsing utilities for model fromJson factories.

/// Parse a dynamic value to double, returning null if not parseable.
double? parseDoubleOrNull(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

/// Parse a dynamic value to double with a default fallback.
double parseDoubleOrDefault(dynamic value, double defaultValue) {
  return parseDoubleOrNull(value) ?? defaultValue;
}
