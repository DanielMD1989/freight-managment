import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart';
import '../../../core/models/truck.dart';
import '../../../core/services/truck_service.dart';
import 'carrier_trucks_screen.dart';
import 'truck_details_screen.dart';

/// Edit Truck Screen for carriers
class EditTruckScreen extends ConsumerStatefulWidget {
  final String truckId;

  const EditTruckScreen({super.key, required this.truckId});

  @override
  ConsumerState<EditTruckScreen> createState() => _EditTruckScreenState();
}

class _EditTruckScreenState extends ConsumerState<EditTruckScreen> {
  final _formKey = GlobalKey<FormState>();
  final _truckService = TruckService();

  // Form controllers
  final _licensePlateController = TextEditingController();
  final _capacityController = TextEditingController();
  final _volumeController = TextEditingController();
  final _lengthController = TextEditingController();
  final _currentCityController = TextEditingController();
  final _currentRegionController = TextEditingController();
  final _ownerNameController = TextEditingController();
  final _contactNameController = TextEditingController();
  final _contactPhoneController = TextEditingController();

  TruckType _selectedTruckType = TruckType.flatbed;
  bool _isSubmitting = false;
  bool _isLoading = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _loadTruckData();
  }

  Future<void> _loadTruckData() async {
    try {
      final result = await _truckService.getTruckById(widget.truckId);

      if (!mounted) return;

      if (result.success && result.data != null) {
        final truck = result.data!;
        _licensePlateController.text = truck.licensePlate;
        _capacityController.text = (truck.capacity / 1000).toString(); // Convert kg to tons
        _volumeController.text = truck.volume?.toString() ?? '';
        _lengthController.text = truck.lengthM?.toString() ?? '';
        _currentCityController.text = truck.currentCity ?? '';
        _currentRegionController.text = truck.currentRegion ?? '';
        _ownerNameController.text = truck.ownerName ?? '';
        _contactNameController.text = truck.contactName ?? '';
        _contactPhoneController.text = truck.contactPhone ?? '';
        _selectedTruckType = truck.truckType;

        setState(() => _isLoading = false);
      } else {
        setState(() {
          _loadError = result.error ?? 'Failed to load truck data';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadError = 'Error: $e';
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _licensePlateController.dispose();
    _capacityController.dispose();
    _volumeController.dispose();
    _lengthController.dispose();
    _currentCityController.dispose();
    _currentRegionController.dispose();
    _ownerNameController.dispose();
    _contactNameController.dispose();
    _contactPhoneController.dispose();
    super.dispose();
  }

  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final result = await _truckService.updateTruck(
        id: widget.truckId,
        licensePlate: _licensePlateController.text.trim().toUpperCase(),
        truckType: truckTypeToString(_selectedTruckType),
        capacity: double.parse(_capacityController.text) * 1000, // Convert tons to kg
        volume: _volumeController.text.isNotEmpty
            ? double.parse(_volumeController.text)
            : null,
        lengthM: _lengthController.text.isNotEmpty
            ? double.parse(_lengthController.text)
            : null,
        currentCity: _currentCityController.text.isNotEmpty
            ? _currentCityController.text.trim()
            : null,
        currentRegion: _currentRegionController.text.isNotEmpty
            ? _currentRegionController.text.trim()
            : null,
        ownerName: _ownerNameController.text.isNotEmpty
            ? _ownerNameController.text.trim()
            : null,
        contactName: _contactNameController.text.isNotEmpty
            ? _contactNameController.text.trim()
            : null,
        contactPhone: _contactPhoneController.text.isNotEmpty
            ? _contactPhoneController.text.trim()
            : null,
      );

      if (!mounted) return;

      if (result.success) {
        // Refresh the trucks list and details
        ref.invalidate(trucksListProvider);
        ref.invalidate(truckDetailProvider(widget.truckId));

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Truck updated successfully'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );

        context.pop();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.error ?? 'Failed to update truck'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Edit Truck')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_loadError != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Edit Truck')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red[400]),
              const SizedBox(height: 16),
              Text(_loadError!),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  setState(() {
                    _isLoading = true;
                    _loadError = null;
                  });
                  _loadTruckData();
                },
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Truck'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Section: Basic Information
            const _SectionHeader(title: 'Basic Information'),
            const SizedBox(height: 16),

            // License Plate
            TextFormField(
              controller: _licensePlateController,
              decoration: const InputDecoration(
                labelText: 'License Plate *',
                hintText: 'e.g., AA-12345',
                prefixIcon: Icon(Icons.numbers),
              ),
              textCapitalization: TextCapitalization.characters,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9\-]')),
              ],
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'License plate is required';
                }
                if (value.trim().length < 3) {
                  return 'License plate must be at least 3 characters';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Truck Type
            DropdownButtonFormField<TruckType>(
              initialValue: _selectedTruckType,
              decoration: const InputDecoration(
                labelText: 'Truck Type *',
                prefixIcon: Icon(Icons.local_shipping),
              ),
              items: TruckType.values.map((type) {
                return DropdownMenuItem(
                  value: type,
                  child: Text(_getTruckTypeLabel(type)),
                );
              }).toList(),
              onChanged: (value) {
                if (value != null) {
                  setState(() => _selectedTruckType = value);
                }
              },
            ),
            const SizedBox(height: 24),

            // Section: Capacity
            const _SectionHeader(title: 'Capacity'),
            const SizedBox(height: 16),

            // Capacity (tons)
            TextFormField(
              controller: _capacityController,
              decoration: const InputDecoration(
                labelText: 'Capacity (tons) *',
                hintText: 'e.g., 20',
                prefixIcon: Icon(Icons.scale),
                suffixText: 'tons',
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
              ],
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Capacity is required';
                }
                final capacity = double.tryParse(value);
                if (capacity == null || capacity <= 0) {
                  return 'Enter a valid capacity';
                }
                if (capacity > 100) {
                  return 'Capacity cannot exceed 100 tons';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Volume and Length (optional)
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _volumeController,
                    decoration: const InputDecoration(
                      labelText: 'Volume (m³)',
                      hintText: 'e.g., 60',
                      prefixIcon: Icon(Icons.view_in_ar),
                      suffixText: 'm³',
                    ),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                    ],
                    validator: (value) {
                      if (value != null && value.isNotEmpty) {
                        final volume = double.tryParse(value);
                        if (volume == null || volume <= 0) {
                          return 'Enter a valid volume';
                        }
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: TextFormField(
                    controller: _lengthController,
                    decoration: const InputDecoration(
                      labelText: 'Length (m)',
                      hintText: 'e.g., 12',
                      prefixIcon: Icon(Icons.straighten),
                      suffixText: 'm',
                    ),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                    ],
                    validator: (value) {
                      if (value != null && value.isNotEmpty) {
                        final length = double.tryParse(value);
                        if (length == null || length <= 0) {
                          return 'Enter a valid length';
                        }
                      }
                      return null;
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Section: Current Location
            const _SectionHeader(title: 'Current Location'),
            const SizedBox(height: 16),

            // Current City
            TextFormField(
              controller: _currentCityController,
              decoration: const InputDecoration(
                labelText: 'Current City',
                hintText: 'e.g., Addis Ababa',
                prefixIcon: Icon(Icons.location_city),
              ),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 16),

            // Current Region
            TextFormField(
              controller: _currentRegionController,
              decoration: const InputDecoration(
                labelText: 'Region',
                hintText: 'e.g., Addis Ababa',
                prefixIcon: Icon(Icons.map_outlined),
              ),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 24),

            // Section: Contact Information
            const _SectionHeader(title: 'Contact Information'),
            const SizedBox(height: 16),

            // Owner Name
            TextFormField(
              controller: _ownerNameController,
              decoration: const InputDecoration(
                labelText: 'Owner Name',
                hintText: 'Name of the truck owner',
                prefixIcon: Icon(Icons.person_outline),
              ),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 16),

            // Contact Name
            TextFormField(
              controller: _contactNameController,
              decoration: const InputDecoration(
                labelText: 'Contact Person',
                hintText: 'Primary contact name',
                prefixIcon: Icon(Icons.contact_phone_outlined),
              ),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 16),

            // Contact Phone
            TextFormField(
              controller: _contactPhoneController,
              decoration: const InputDecoration(
                labelText: 'Contact Phone',
                hintText: '+251 9XX XXX XXXX',
                prefixIcon: Icon(Icons.phone_outlined),
              ),
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[\d\+\-\s]')),
              ],
              validator: (value) {
                if (value != null && value.isNotEmpty) {
                  final cleaned = value.replaceAll(RegExp(r'[\s\-]'), '');
                  if (cleaned.length < 9) {
                    return 'Enter a valid phone number';
                  }
                }
                return null;
              },
            ),
            const SizedBox(height: 32),

            // Submit button
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitForm,
                child: _isSubmitting
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Save Changes'),
              ),
            ),
            const SizedBox(height: 16),

            // Cancel button
            TextButton(
              onPressed: _isSubmitting ? null : () => context.pop(),
              child: const Text('Cancel'),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  String _getTruckTypeLabel(TruckType type) {
    switch (type) {
      case TruckType.flatbed:
        return 'Flatbed';
      case TruckType.refrigerated:
        return 'Refrigerated (Reefer)';
      case TruckType.tanker:
        return 'Tanker';
      case TruckType.container:
        return 'Container';
      case TruckType.dryVan:
        return 'Dry Van';
      case TruckType.lowboy:
        return 'Lowboy';
      case TruckType.dumpTruck:
        return 'Dump Truck';
      case TruckType.boxTruck:
        return 'Box Truck';
    }
  }
}

/// Section header widget
class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 20,
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
