// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'FreightFlow';

  @override
  String get login => 'Login';

  @override
  String get logout => 'Logout';

  @override
  String get register => 'Register';

  @override
  String get email => 'Email';

  @override
  String get password => 'Password';

  @override
  String get confirmPassword => 'Confirm Password';

  @override
  String get forgotPassword => 'Forgot Password?';

  @override
  String get dontHaveAccount => 'Don\'t have an account?';

  @override
  String get alreadyHaveAccount => 'Already have an account?';

  @override
  String get home => 'Home';

  @override
  String get loads => 'Loads';

  @override
  String get trucks => 'Trucks';

  @override
  String get trips => 'Trips';

  @override
  String get wallet => 'Wallet';

  @override
  String get notifications => 'Notifications';

  @override
  String get profile => 'Profile';

  @override
  String get settings => 'Settings';

  @override
  String get loadboard => 'Load Board';

  @override
  String get truckboard => 'Truck Board';

  @override
  String get postLoad => 'Post Load';

  @override
  String get postTruck => 'Post Truck';

  @override
  String get searchLoads => 'Search Loads';

  @override
  String get searchTrucks => 'Search Trucks';

  @override
  String get noLoadsFound => 'No loads found';

  @override
  String get noTrucksFound => 'No trucks found';

  @override
  String get pickup => 'Pickup';

  @override
  String get delivery => 'Delivery';

  @override
  String get pickupLocation => 'Pickup Location';

  @override
  String get deliveryLocation => 'Delivery Location';

  @override
  String get pickupDate => 'Pickup Date';

  @override
  String get deliveryDate => 'Delivery Date';

  @override
  String get weight => 'Weight';

  @override
  String get price => 'Price';

  @override
  String get distance => 'Distance';

  @override
  String get status => 'Status';

  @override
  String get statusPosted => 'Posted';

  @override
  String get statusAssigned => 'Assigned';

  @override
  String get statusInTransit => 'In Transit';

  @override
  String get statusDelivered => 'Delivered';

  @override
  String get statusCompleted => 'Completed';

  @override
  String get statusCancelled => 'Cancelled';

  @override
  String get currentBalance => 'Current Balance';

  @override
  String get recentTransactions => 'Recent Transactions';

  @override
  String get addFunds => 'Add Funds';

  @override
  String get withdraw => 'Withdraw';

  @override
  String get commission => 'Commission';

  @override
  String get payment => 'Payment';

  @override
  String get refund => 'Refund';

  @override
  String get noTransactions => 'No transactions yet';

  @override
  String get transactionHistoryWillAppear =>
      'Your transaction history will appear here';

  @override
  String get proofOfDelivery => 'Proof of Delivery';

  @override
  String get uploadPod => 'Upload POD';

  @override
  String get takePhoto => 'Take Photo';

  @override
  String get fromGallery => 'From Gallery';

  @override
  String uploadPhotos(int count) {
    return 'Upload $count Photo(s)';
  }

  @override
  String get uploading => 'Uploading...';

  @override
  String get uploadSuccess => 'Upload successful';

  @override
  String get uploadFailed => 'Upload failed';

  @override
  String get gpsTracking => 'GPS Tracking';

  @override
  String get gpsTrackingDescription =>
      'Enable real-time location tracking during trips';

  @override
  String get pushNotifications => 'Push Notifications';

  @override
  String get pushNotificationsDescription =>
      'Receive alerts for loads, trips, and payments';

  @override
  String get language => 'Language';

  @override
  String get english => 'English';

  @override
  String get amharic => 'Amharic';

  @override
  String get darkMode => 'Dark Mode';

  @override
  String get account => 'Account';

  @override
  String get editProfile => 'Edit Profile';

  @override
  String get changePassword => 'Change Password';

  @override
  String get general => 'General';

  @override
  String get about => 'About';

  @override
  String get version => 'Version';

  @override
  String get privacyPolicy => 'Privacy Policy';

  @override
  String get termsOfService => 'Terms of Service';

  @override
  String get cancel => 'Cancel';

  @override
  String get confirm => 'Confirm';

  @override
  String get save => 'Save';

  @override
  String get delete => 'Delete';

  @override
  String get edit => 'Edit';

  @override
  String get retry => 'Retry';

  @override
  String get loading => 'Loading...';

  @override
  String get error => 'Error';

  @override
  String get success => 'Success';

  @override
  String get somethingWentWrong => 'Something went wrong';

  @override
  String get noInternetConnection => 'No internet connection';

  @override
  String get connectionTimeout => 'Connection timeout';

  @override
  String get plateNumber => 'Plate Number';

  @override
  String get truckType => 'Truck Type';

  @override
  String get capacity => 'Capacity';

  @override
  String get available => 'Available';

  @override
  String get unavailable => 'Unavailable';

  @override
  String get onTrip => 'On Trip';

  @override
  String get viewDetails => 'View Details';

  @override
  String get requestLoad => 'Request Load';

  @override
  String get requestTruck => 'Request Truck';

  @override
  String get acceptRequest => 'Accept Request';

  @override
  String get rejectRequest => 'Reject Request';

  @override
  String get pendingRequests => 'Pending Requests';

  @override
  String get loadRequests => 'Load Requests';

  @override
  String get truckRequests => 'Truck Requests';

  @override
  String get startTrip => 'Start Trip';

  @override
  String get endTrip => 'End Trip';

  @override
  String get trackShipment => 'Track Shipment';

  @override
  String get estimatedArrival => 'Estimated Arrival';

  @override
  String get tripProgress => 'Trip Progress';

  @override
  String get remainingDistance => 'Remaining Distance';

  @override
  String get markAsRead => 'Mark as Read';

  @override
  String get markAllAsRead => 'Mark All as Read';

  @override
  String get noNotifications => 'No notifications';

  @override
  String get today => 'Today';

  @override
  String get yesterday => 'Yesterday';

  @override
  String get thisWeek => 'This Week';

  @override
  String get earlier => 'Earlier';

  @override
  String get comingSoon => 'Coming Soon';

  @override
  String get featureComingSoon => 'This feature is coming soon!';

  @override
  String get logoutConfirmTitle => 'Logout';

  @override
  String get logoutConfirmMessage => 'Are you sure you want to logout?';

  @override
  String get refreshing => 'Refreshing...';

  @override
  String get pullToRefresh => 'Pull to refresh';

  @override
  String get filterBy => 'Filter by';

  @override
  String get sortBy => 'Sort by';

  @override
  String get all => 'All';

  @override
  String get active => 'Active';

  @override
  String get completed => 'Completed';

  @override
  String get shipper => 'Shipper';

  @override
  String get carrier => 'Carrier';

  @override
  String get driver => 'Driver';

  @override
  String get selectRole => 'Select Role';

  @override
  String get fullName => 'Full Name';

  @override
  String get phoneNumber => 'Phone Number';

  @override
  String get companyName => 'Company Name';

  @override
  String get tradeLicense => 'Trade License';

  @override
  String get km => 'km';

  @override
  String get ton => 'ton';

  @override
  String get tons => 'tons';

  @override
  String get etb => 'ETB';

  @override
  String get accountVerification => 'Account Verification';

  @override
  String get verificationProgress => 'Progress';

  @override
  String get verificationSteps => 'Verification Steps';

  @override
  String get stepAccountCreated => 'Account Created';

  @override
  String get stepDocumentsUploaded => 'Documents Uploaded';

  @override
  String get stepAdminReview => 'Admin Review';

  @override
  String get stepAccountActivated => 'Account Activated';

  @override
  String get statusRegistrationComplete => 'Registration Complete';

  @override
  String get statusUnderReview => 'Under Review';

  @override
  String get inProgress => 'In Progress';

  @override
  String get uploadDocuments => 'Upload Documents';

  @override
  String get awaitingReview => 'Awaiting Review';

  @override
  String get documentsBeingReviewed =>
      'Your documents are being reviewed. This usually takes 1-2 business days.';

  @override
  String get uploadVerificationDocuments =>
      'Please upload your verification documents to continue.';

  @override
  String get estimatedReviewTime => 'Estimated review time';

  @override
  String get oneToTwoBusinessDays => '1-2 business days';

  @override
  String get contactSupport => 'Contact Support';

  @override
  String get verificationPending => 'Verification Pending';

  @override
  String get accountPendingVerification =>
      'Your account is pending verification';

  @override
  String get limitedAccessMessage =>
      'You have limited access until your account is verified.';

  @override
  String get dashboard => 'Dashboard';

  @override
  String get findLoads => 'Find Loads';

  @override
  String get postTrucks => 'Post Trucks';

  @override
  String get myLoads => 'My Loads';

  @override
  String get myTrucks => 'My Trucks';

  @override
  String get myTrips => 'My Trips';

  @override
  String get findTrucks => 'Find Trucks';

  @override
  String get track => 'Track';

  @override
  String get shipments => 'Shipments';

  @override
  String get truckBookings => 'Truck Bookings';

  @override
  String get trackMap => 'Track Map';

  @override
  String get postNewLoad => 'Post New Load';

  @override
  String get myShipments => 'My Shipments';

  @override
  String get myTruckRequests => 'My Truck Requests';

  @override
  String get trackShipments => 'Track Shipments';
}
