import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/models/trip.dart';
import '../../../core/services/trip_service.dart';
import 'carrier_trip_details_screen.dart';
import 'carrier_trips_screen.dart';

/// POD Upload Screen
class PodUploadScreen extends ConsumerStatefulWidget {
  final String tripId;

  const PodUploadScreen({super.key, required this.tripId});

  @override
  ConsumerState<PodUploadScreen> createState() => _PodUploadScreenState();
}

class _PodUploadScreenState extends ConsumerState<PodUploadScreen> {
  final _tripService = TripService();
  final _notesController = TextEditingController();
  final _picker = ImagePicker();

  List<XFile> _selectedFiles = [];
  List<TripPod> _existingPods = [];
  bool _isUploading = false;
  bool _isLoadingPods = true;

  @override
  void initState() {
    super.initState();
    _loadExistingPods();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadExistingPods() async {
    final result = await _tripService.getTripPods(widget.tripId);
    if (mounted) {
      setState(() {
        _existingPods = result.success ? result.data ?? [] : [];
        _isLoadingPods = false;
      });
    }
  }

  Future<void> _pickFromCamera() async {
    try {
      final photo = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 80,
        maxWidth: 1920,
        maxHeight: 1920,
      );
      if (photo != null && mounted) {
        setState(() => _selectedFiles.add(photo));
      }
    } catch (e) {
      _showError('Failed to access camera: $e');
    }
  }

  Future<void> _pickFromGallery() async {
    try {
      final images = await _picker.pickMultiImage(
        imageQuality: 80,
        maxWidth: 1920,
        maxHeight: 1920,
      );
      if (images.isNotEmpty && mounted) {
        setState(() => _selectedFiles.addAll(images));
      }
    } catch (e) {
      _showError('Failed to access gallery: $e');
    }
  }

  void _removeFile(int index) {
    setState(() => _selectedFiles.removeAt(index));
  }

  Future<void> _uploadPods() async {
    if (_selectedFiles.isEmpty) {
      _showError('Please select at least one image');
      return;
    }

    setState(() => _isUploading = true);

    try {
      int successCount = 0;
      for (final file in _selectedFiles) {
        final result = await _tripService.uploadPod(
          tripId: widget.tripId,
          filePath: file.path,
          fileName: file.name,
          notes: _notesController.text.isNotEmpty
              ? _notesController.text.trim()
              : null,
        );

        if (result.success) {
          successCount++;
        }
      }

      if (!mounted) return;

      if (successCount == _selectedFiles.length) {
        _showSuccess('All documents uploaded successfully!');
        ref.invalidate(tripDetailProvider(widget.tripId));
        ref.invalidate(carrierTripsProvider);
        context.pop();
      } else if (successCount > 0) {
        _showSuccess('$successCount of ${_selectedFiles.length} documents uploaded');
        _loadExistingPods();
        setState(() => _selectedFiles = []);
      } else {
        _showError('Failed to upload documents');
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.success),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.error),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Proof of Delivery'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Info banner
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.primary50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, color: AppColors.primary700),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Upload proof of delivery photos (signed receipt, delivery photos, etc.) to complete this trip.',
                          style: TextStyle(color: AppColors.primary700, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Existing PODs
                if (_isLoadingPods)
                  const Center(child: CircularProgressIndicator())
                else if (_existingPods.isNotEmpty) ...[
                  const Text(
                    'Uploaded Documents',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 12),
                  ..._existingPods.map((pod) => _ExistingPodItem(pod: pod)),
                  const SizedBox(height: 24),
                ],

                // Add photos section
                const Text(
                  'Add New Photos',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),

                // Capture buttons
                Row(
                  children: [
                    Expanded(
                      child: _CaptureButton(
                        icon: Icons.camera_alt,
                        label: 'Take Photo',
                        onTap: _pickFromCamera,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _CaptureButton(
                        icon: Icons.photo_library,
                        label: 'From Gallery',
                        onTap: _pickFromGallery,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Selected files grid
                if (_selectedFiles.isNotEmpty) ...[
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                    ),
                    itemCount: _selectedFiles.length,
                    itemBuilder: (context, index) {
                      return _SelectedFileItem(
                        file: _selectedFiles[index],
                        onRemove: () => _removeFile(index),
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                ],

                // Notes field
                TextField(
                  controller: _notesController,
                  decoration: const InputDecoration(
                    labelText: 'Notes (optional)',
                    hintText: 'Add any notes about the delivery...',
                    prefixIcon: Icon(Icons.note),
                  ),
                  maxLines: 3,
                ),
              ],
            ),
          ),

          // Upload button
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton.icon(
                  onPressed: _isUploading || _selectedFiles.isEmpty
                      ? null
                      : _uploadPods,
                  icon: _isUploading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.cloud_upload),
                  label: Text(_isUploading
                      ? 'Uploading...'
                      : 'Upload ${_selectedFiles.length} Photo${_selectedFiles.length != 1 ? 's' : ''}'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Capture button
class _CaptureButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _CaptureButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border, width: 2),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, size: 32, color: AppColors.primary),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}

/// Selected file item
class _SelectedFileItem extends StatelessWidget {
  final XFile file;
  final VoidCallback onRemove;

  const _SelectedFileItem({
    required this.file,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.file(
            File(file.path),
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: InkWell(
            onTap: onRemove,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(
                color: Colors.black54,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.close,
                color: Colors.white,
                size: 16,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Existing POD item
class _ExistingPodItem extends StatelessWidget {
  final TripPod pod;

  const _ExistingPodItem({required this.pod});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AppColors.success.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            pod.isImage ? Icons.image : Icons.picture_as_pdf,
            color: AppColors.success,
          ),
        ),
        title: Text(
          pod.fileName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          DateFormat('MMM d, yyyy h:mm a').format(pod.uploadedAt),
          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
        ),
        trailing: Icon(Icons.check_circle, color: AppColors.success),
      ),
    );
  }
}
