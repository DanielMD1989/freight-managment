import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/models/load.dart';
import '../../../core/models/truck.dart';
import '../../../core/services/load_service.dart';

/// Post Load Screen - Multi-step form to create a new load
class PostLoadScreen extends ConsumerStatefulWidget {
  const PostLoadScreen({super.key});

  @override
  ConsumerState<PostLoadScreen> createState() => _PostLoadScreenState();
}

class _PostLoadScreenState extends ConsumerState<PostLoadScreen> {
  final _formKey = GlobalKey<FormState>();
  int _currentStep = 0;
  bool _isSubmitting = false;

  // Step 1: Route
  final _pickupCityController = TextEditingController();
  final _deliveryCityController = TextEditingController();
  final _pickupAddressController = TextEditingController();
  final _deliveryAddressController = TextEditingController();
  final _pickupDockHoursController = TextEditingController();
  final _deliveryDockHoursController = TextEditingController();

  // Step 2: Schedule
  DateTime _pickupDate = DateTime.now().add(const Duration(days: 1));
  DateTime _deliveryDate = DateTime.now().add(const Duration(days: 2));

  // Step 3: Cargo Details
  TruckType _truckType = TruckType.flatbed;
  final _weightController = TextEditingController();
  final _volumeController = TextEditingController();
  final _cargoDescriptionController = TextEditingController();
  LoadType _fullPartial = LoadType.full;
  bool _isFragile = false;
  bool _requiresRefrigeration = false;

  // Pricing (required by API)
  final _tripKmController = TextEditingController();
  final _rateController = TextEditingController();

  // Step 4: Additional Info
  final _safetyNotesController = TextEditingController();
  final _specialInstructionsController = TextEditingController();
  bool _isAnonymous = false;
  final _contactNameController = TextEditingController();
  final _contactPhoneController = TextEditingController();

  @override
  void dispose() {
    _pickupCityController.dispose();
    _deliveryCityController.dispose();
    _pickupAddressController.dispose();
    _deliveryAddressController.dispose();
    _pickupDockHoursController.dispose();
    _deliveryDockHoursController.dispose();
    _weightController.dispose();
    _volumeController.dispose();
    _cargoDescriptionController.dispose();
    _safetyNotesController.dispose();
    _specialInstructionsController.dispose();
    _contactNameController.dispose();
    _contactPhoneController.dispose();
    _tripKmController.dispose();
    _rateController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Post New Load'),
      ),
      body: SafeArea(
        top: false, // AppBar handles top safe area
        child: Form(
          key: _formKey,
          child: Stepper(
          type: StepperType.vertical,
          currentStep: _currentStep,
          onStepContinue: _onStepContinue,
          onStepCancel: _onStepCancel,
          onStepTapped: (step) => setState(() => _currentStep = step),
          controlsBuilder: (context, details) {
            return Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Row(
                children: [
                  if (_currentStep < 3)
                    ElevatedButton(
                      onPressed: details.onStepContinue,
                      child: const Text('Continue'),
                    )
                  else
                    ElevatedButton(
                      onPressed: _isSubmitting ? null : _submitLoad,
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Post Load'),
                    ),
                  if (_currentStep > 0) ...[
                    const SizedBox(width: 12),
                    TextButton(
                      onPressed: details.onStepCancel,
                      child: const Text('Back'),
                    ),
                  ],
                ],
              ),
            );
          },
          steps: [
            Step(
              title: const Text('Route'),
              subtitle: _currentStep > 0
                  ? Text(
                      '${_pickupCityController.text} → ${_deliveryCityController.text}')
                  : null,
              isActive: _currentStep >= 0,
              state: _currentStep > 0 ? StepState.complete : StepState.indexed,
              content: _buildRouteStep(),
            ),
            Step(
              title: const Text('Schedule'),
              subtitle: _currentStep > 1
                  ? Text(
                      'Pickup: ${DateFormat('MMM d').format(_pickupDate)}')
                  : null,
              isActive: _currentStep >= 1,
              state: _currentStep > 1 ? StepState.complete : StepState.indexed,
              content: _buildScheduleStep(),
            ),
            Step(
              title: const Text('Cargo Details'),
              subtitle: _currentStep > 2
                  ? Text('${_truckType.toString().split('.').last}, '
                      '${_weightController.text}kg')
                  : null,
              isActive: _currentStep >= 2,
              state: _currentStep > 2 ? StepState.complete : StepState.indexed,
              content: _buildCargoStep(),
            ),
            Step(
              title: const Text('Additional Info'),
              subtitle: const Text('Optional details'),
              isActive: _currentStep >= 3,
              state: StepState.indexed,
              content: _buildAdditionalInfoStep(),
            ),
          ],
          ),
        ),
      ),
    );
  }

  Widget _buildRouteStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Pickup Location',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: _pickupCityController,
          decoration: const InputDecoration(
            labelText: 'City *',
            hintText: 'e.g., Addis Ababa',
            prefixIcon: Icon(Icons.location_on),
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter pickup city';
            }
            if (value.length < 2) {
              return 'City name must be at least 2 characters';
            }
            return null;
          },
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _pickupAddressController,
          decoration: const InputDecoration(
            labelText: 'Address (optional)',
            hintText: 'Street address or landmark',
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _pickupDockHoursController,
          decoration: const InputDecoration(
            labelText: 'Dock Hours (optional)',
            hintText: 'e.g., 8:00 AM - 5:00 PM',
            prefixIcon: Icon(Icons.access_time),
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'Delivery Location',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: _deliveryCityController,
          decoration: const InputDecoration(
            labelText: 'City *',
            hintText: 'e.g., Mekelle',
            prefixIcon: Icon(Icons.flag),
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter delivery city';
            }
            if (value.length < 2) {
              return 'City name must be at least 2 characters';
            }
            return null;
          },
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _deliveryAddressController,
          decoration: const InputDecoration(
            labelText: 'Address (optional)',
            hintText: 'Street address or landmark',
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _deliveryDockHoursController,
          decoration: const InputDecoration(
            labelText: 'Dock Hours (optional)',
            hintText: 'e.g., 9:00 AM - 6:00 PM',
            prefixIcon: Icon(Icons.access_time),
          ),
        ),
      ],
    );
  }

  Widget _buildScheduleStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Pickup Date
        const Text(
          'Pickup Date *',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: () => _selectDate(true),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.calendar_today, color: AppColors.primary),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('EEEE, MMMM d, yyyy').format(_pickupDate),
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      DateFormat('h:mm a').format(_pickupDate),
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => _selectTime(true),
                  child: const Text('Set Time'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),

        // Delivery Date
        const Text(
          'Delivery Date *',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: () => _selectDate(false),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.calendar_today, color: AppColors.accent),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('EEEE, MMMM d, yyyy').format(_deliveryDate),
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      DateFormat('h:mm a').format(_deliveryDate),
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => _selectTime(false),
                  child: const Text('Set Time'),
                ),
              ],
            ),
          ),
        ),
        if (_deliveryDate.isBefore(_pickupDate))
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'Delivery date must be after pickup date',
              style: TextStyle(color: AppColors.error, fontSize: 12),
            ),
          ),
      ],
    );
  }

  Widget _buildCargoStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Truck Type
        const Text(
          'Required Truck Type *',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<TruckType>(
          initialValue: _truckType,
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.local_shipping),
          ),
          items: TruckType.values.map((type) {
            return DropdownMenuItem(
              value: type,
              child: Text(_getTruckTypeName(type)),
            );
          }).toList(),
          onChanged: (value) {
            if (value != null) {
              setState(() => _truckType = value);
            }
          },
        ),
        const SizedBox(height: 16),

        // Weight and Volume
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _weightController,
                decoration: const InputDecoration(
                  labelText: 'Weight (kg) *',
                  hintText: 'e.g., 5000',
                  prefixIcon: Icon(Icons.scale),
                ),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Required';
                  }
                  if (double.tryParse(value) == null) {
                    return 'Invalid number';
                  }
                  return null;
                },
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextFormField(
                controller: _volumeController,
                decoration: const InputDecoration(
                  labelText: 'Volume (m³)',
                  hintText: 'Optional',
                  prefixIcon: Icon(Icons.straighten),
                ),
                keyboardType: TextInputType.number,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Cargo Description
        TextFormField(
          controller: _cargoDescriptionController,
          decoration: const InputDecoration(
            labelText: 'Cargo Description *',
            hintText: 'What are you shipping? (min 5 characters)',
            prefixIcon: Icon(Icons.inventory_2),
          ),
          maxLines: 2,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please describe the cargo';
            }
            if (value.length < 5) {
              return 'Description must be at least 5 characters';
            }
            return null;
          },
        ),
        const SizedBox(height: 16),

        // Full/Partial
        const Text(
          'Load Type',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        const SizedBox(height: 8),
        SegmentedButton<LoadType>(
          segments: const [
            ButtonSegment(
              value: LoadType.full,
              label: Text('Full Truck'),
              icon: Icon(Icons.check_box),
            ),
            ButtonSegment(
              value: LoadType.partial,
              label: Text('Partial'),
              icon: Icon(Icons.view_module),
            ),
          ],
          selected: {_fullPartial},
          onSelectionChanged: (set) {
            setState(() => _fullPartial = set.first);
          },
        ),
        const SizedBox(height: 16),

        // Special requirements
        const Text(
          'Special Requirements',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        const SizedBox(height: 8),
        CheckboxListTile(
          value: _isFragile,
          onChanged: (value) => setState(() => _isFragile = value ?? false),
          title: const Text('Fragile Cargo'),
          subtitle: const Text('Handle with care'),
          secondary: Icon(Icons.warning_amber,
              color: _isFragile ? AppColors.warning : Colors.grey),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
        ),
        CheckboxListTile(
          value: _requiresRefrigeration,
          onChanged: (value) =>
              setState(() => _requiresRefrigeration = value ?? false),
          title: const Text('Refrigeration Required'),
          subtitle: const Text('Temperature-controlled transport'),
          secondary: Icon(Icons.ac_unit,
              color: _requiresRefrigeration ? AppColors.info : Colors.grey),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
        ),
      ],
    );
  }

  Widget _buildAdditionalInfoStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Safety Notes
        TextFormField(
          controller: _safetyNotesController,
          decoration: const InputDecoration(
            labelText: 'Safety Notes',
            hintText: 'Any safety concerns or hazmat info...',
            prefixIcon: Icon(Icons.health_and_safety),
          ),
          maxLines: 2,
        ),
        const SizedBox(height: 16),

        // Special Instructions
        TextFormField(
          controller: _specialInstructionsController,
          decoration: const InputDecoration(
            labelText: 'Special Instructions',
            hintText: 'Loading/unloading requirements, etc...',
            prefixIcon: Icon(Icons.info_outline),
          ),
          maxLines: 2,
        ),
        const SizedBox(height: 24),

        // Privacy
        const Text(
          'Privacy Settings',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          value: _isAnonymous,
          onChanged: (value) => setState(() => _isAnonymous = value),
          title: const Text('Post Anonymously'),
          subtitle: const Text('Hide your company info from carriers'),
          secondary: Icon(Icons.visibility_off,
              color: _isAnonymous ? AppColors.primary : Colors.grey),
          contentPadding: EdgeInsets.zero,
        ),

        if (!_isAnonymous) ...[
          const SizedBox(height: 16),
          const Text(
            'Contact Information (shown to carriers)',
            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _contactNameController,
            decoration: const InputDecoration(
              labelText: 'Contact Name',
              prefixIcon: Icon(Icons.person),
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _contactPhoneController,
            decoration: const InputDecoration(
              labelText: 'Contact Phone',
              prefixIcon: Icon(Icons.phone),
            ),
            keyboardType: TextInputType.phone,
          ),
        ],

        const SizedBox(height: 24),
        // Summary
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.primary50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.primary200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.info, color: AppColors.primary, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Load Summary',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _SummaryRow(
                label: 'Route',
                value:
                    '${_pickupCityController.text} → ${_deliveryCityController.text}',
              ),
              _SummaryRow(
                label: 'Pickup',
                value: DateFormat('MMM d, yyyy').format(_pickupDate),
              ),
              _SummaryRow(
                label: 'Delivery',
                value: DateFormat('MMM d, yyyy').format(_deliveryDate),
              ),
              _SummaryRow(
                label: 'Truck Type',
                value: _getTruckTypeName(_truckType),
              ),
              _SummaryRow(
                label: 'Weight',
                value: '${_weightController.text} kg',
              ),
              _SummaryRow(
                label: 'Load Type',
                value: _fullPartial == LoadType.full ? 'Full Truck' : 'Partial',
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _getTruckTypeName(TruckType type) {
    switch (type) {
      case TruckType.flatbed:
        return 'Flatbed';
      case TruckType.refrigerated:
        return 'Refrigerated';
      case TruckType.tanker:
        return 'Tanker';
      case TruckType.container:
        return 'Container';
      case TruckType.dryVan:
        return 'Dry Van';
      case TruckType.boxTruck:
        return 'Box Truck';
      case TruckType.lowboy:
        return 'Lowboy';
      case TruckType.dumpTruck:
        return 'Dump Truck';
    }
  }

  Future<void> _selectDate(bool isPickup) async {
    final initialDate = isPickup ? _pickupDate : _deliveryDate;
    final firstDate = DateTime.now();
    final lastDate = DateTime.now().add(const Duration(days: 365));

    final date = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: lastDate,
    );

    if (date != null) {
      setState(() {
        if (isPickup) {
          _pickupDate = DateTime(
            date.year,
            date.month,
            date.day,
            _pickupDate.hour,
            _pickupDate.minute,
          );
          // Ensure delivery is after pickup
          if (_deliveryDate.isBefore(_pickupDate)) {
            _deliveryDate = _pickupDate.add(const Duration(days: 1));
          }
        } else {
          _deliveryDate = DateTime(
            date.year,
            date.month,
            date.day,
            _deliveryDate.hour,
            _deliveryDate.minute,
          );
        }
      });
    }
  }

  Future<void> _selectTime(bool isPickup) async {
    final initialTime = TimeOfDay.fromDateTime(
      isPickup ? _pickupDate : _deliveryDate,
    );

    final time = await showTimePicker(
      context: context,
      initialTime: initialTime,
    );

    if (time != null) {
      setState(() {
        if (isPickup) {
          _pickupDate = DateTime(
            _pickupDate.year,
            _pickupDate.month,
            _pickupDate.day,
            time.hour,
            time.minute,
          );
        } else {
          _deliveryDate = DateTime(
            _deliveryDate.year,
            _deliveryDate.month,
            _deliveryDate.day,
            time.hour,
            time.minute,
          );
        }
      });
    }
  }

  void _onStepContinue() {
    // Validate current step
    if (_currentStep == 0) {
      if (_pickupCityController.text.isEmpty ||
          _deliveryCityController.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please fill in pickup and delivery cities'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
    } else if (_currentStep == 1) {
      if (_deliveryDate.isBefore(_pickupDate)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Delivery date must be after pickup date'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
    } else if (_currentStep == 2) {
      if (_weightController.text.isEmpty ||
          _cargoDescriptionController.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please fill in weight and cargo description'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
    }

    if (_currentStep < 3) {
      setState(() => _currentStep++);
    }
  }

  void _onStepCancel() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
    }
  }

  Future<void> _submitLoad() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    final service = LoadService();
    final result = await service.createLoad(
      pickupCity: _pickupCityController.text.trim(),
      deliveryCity: _deliveryCityController.text.trim(),
      pickupDate: _pickupDate,
      deliveryDate: _deliveryDate,
      truckType: truckTypeToString(_truckType),
      weight: double.parse(_weightController.text),
      cargoDescription: _cargoDescriptionController.text.trim(),
      pickupAddress: _pickupAddressController.text.trim().isNotEmpty
          ? _pickupAddressController.text.trim()
          : null,
      deliveryAddress: _deliveryAddressController.text.trim().isNotEmpty
          ? _deliveryAddressController.text.trim()
          : null,
      pickupDockHours: _pickupDockHoursController.text.trim().isNotEmpty
          ? _pickupDockHoursController.text.trim()
          : null,
      deliveryDockHours: _deliveryDockHoursController.text.trim().isNotEmpty
          ? _deliveryDockHoursController.text.trim()
          : null,
      volume: _volumeController.text.isNotEmpty
          ? double.tryParse(_volumeController.text)
          : null,
      fullPartial: _fullPartial == LoadType.full ? 'FULL' : 'PARTIAL',
      isFragile: _isFragile,
      requiresRefrigeration: _requiresRefrigeration,
      isAnonymous: _isAnonymous,
      shipperContactName: _contactNameController.text.trim().isNotEmpty
          ? _contactNameController.text.trim()
          : null,
      shipperContactPhone: _contactPhoneController.text.trim().isNotEmpty
          ? _contactPhoneController.text.trim()
          : null,
      safetyNotes: _safetyNotesController.text.trim().isNotEmpty
          ? _safetyNotesController.text.trim()
          : null,
      specialInstructions: _specialInstructionsController.text.trim().isNotEmpty
          ? _specialInstructionsController.text.trim()
          : null,
      status: 'POSTED', // Post directly
    );

    if (!mounted) return;

    setState(() => _isSubmitting = false);

    if (result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Load posted successfully!'),
          backgroundColor: AppColors.success,
        ),
      );
      context.pop(true); // Return true to indicate success
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.error ?? 'Failed to post load'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey[700],
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
