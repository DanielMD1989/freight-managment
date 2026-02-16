import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_am.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('am'),
    Locale('en')
  ];

  /// The app name
  ///
  /// In en, this message translates to:
  /// **'FreightET'**
  String get appName;

  /// Login button text
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get login;

  /// Logout button text
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// Register button text
  ///
  /// In en, this message translates to:
  /// **'Register'**
  String get register;

  /// Email field label
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// Password field label
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// Confirm password field label
  ///
  /// In en, this message translates to:
  /// **'Confirm Password'**
  String get confirmPassword;

  /// Forgot password link text
  ///
  /// In en, this message translates to:
  /// **'Forgot Password?'**
  String get forgotPassword;

  /// Sign up prompt text
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account?'**
  String get dontHaveAccount;

  /// Sign in prompt text
  ///
  /// In en, this message translates to:
  /// **'Already have an account?'**
  String get alreadyHaveAccount;

  /// Home navigation label
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// Loads navigation label
  ///
  /// In en, this message translates to:
  /// **'Loads'**
  String get loads;

  /// Trucks navigation label
  ///
  /// In en, this message translates to:
  /// **'Trucks'**
  String get trucks;

  /// Trips navigation label
  ///
  /// In en, this message translates to:
  /// **'Trips'**
  String get trips;

  /// Wallet navigation label
  ///
  /// In en, this message translates to:
  /// **'Wallet'**
  String get wallet;

  /// Notifications navigation label
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications;

  /// Profile navigation label
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// Settings navigation label
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// Load board screen title
  ///
  /// In en, this message translates to:
  /// **'Load Board'**
  String get loadboard;

  /// Truck board screen title
  ///
  /// In en, this message translates to:
  /// **'Truck Board'**
  String get truckboard;

  /// Post load button text
  ///
  /// In en, this message translates to:
  /// **'Post Load'**
  String get postLoad;

  /// Post truck button text
  ///
  /// In en, this message translates to:
  /// **'Post Truck'**
  String get postTruck;

  /// Search loads placeholder
  ///
  /// In en, this message translates to:
  /// **'Search Loads'**
  String get searchLoads;

  /// Search trucks placeholder
  ///
  /// In en, this message translates to:
  /// **'Search Trucks'**
  String get searchTrucks;

  /// Empty state for loads
  ///
  /// In en, this message translates to:
  /// **'No loads found'**
  String get noLoadsFound;

  /// Empty state for trucks
  ///
  /// In en, this message translates to:
  /// **'No trucks found'**
  String get noTrucksFound;

  /// Pickup label
  ///
  /// In en, this message translates to:
  /// **'Pickup'**
  String get pickup;

  /// Delivery label
  ///
  /// In en, this message translates to:
  /// **'Delivery'**
  String get delivery;

  /// Pickup location field label
  ///
  /// In en, this message translates to:
  /// **'Pickup Location'**
  String get pickupLocation;

  /// Delivery location field label
  ///
  /// In en, this message translates to:
  /// **'Delivery Location'**
  String get deliveryLocation;

  /// Pickup date field label
  ///
  /// In en, this message translates to:
  /// **'Pickup Date'**
  String get pickupDate;

  /// Delivery date field label
  ///
  /// In en, this message translates to:
  /// **'Delivery Date'**
  String get deliveryDate;

  /// Weight field label
  ///
  /// In en, this message translates to:
  /// **'Weight'**
  String get weight;

  /// Price field label
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get price;

  /// Distance label
  ///
  /// In en, this message translates to:
  /// **'Distance'**
  String get distance;

  /// Status label
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get status;

  /// Posted status
  ///
  /// In en, this message translates to:
  /// **'Posted'**
  String get statusPosted;

  /// Assigned status
  ///
  /// In en, this message translates to:
  /// **'Assigned'**
  String get statusAssigned;

  /// In transit status
  ///
  /// In en, this message translates to:
  /// **'In Transit'**
  String get statusInTransit;

  /// Delivered status
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get statusDelivered;

  /// Completed status
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get statusCompleted;

  /// Cancelled status
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get statusCancelled;

  /// Wallet current balance label
  ///
  /// In en, this message translates to:
  /// **'Current Balance'**
  String get currentBalance;

  /// Recent transactions section title
  ///
  /// In en, this message translates to:
  /// **'Recent Transactions'**
  String get recentTransactions;

  /// Add funds button
  ///
  /// In en, this message translates to:
  /// **'Add Funds'**
  String get addFunds;

  /// Withdraw button
  ///
  /// In en, this message translates to:
  /// **'Withdraw'**
  String get withdraw;

  /// Commission transaction type
  ///
  /// In en, this message translates to:
  /// **'Commission'**
  String get commission;

  /// Payment transaction type
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get payment;

  /// Refund transaction type
  ///
  /// In en, this message translates to:
  /// **'Refund'**
  String get refund;

  /// Empty transactions message
  ///
  /// In en, this message translates to:
  /// **'No transactions yet'**
  String get noTransactions;

  /// Empty transactions description
  ///
  /// In en, this message translates to:
  /// **'Your transaction history will appear here'**
  String get transactionHistoryWillAppear;

  /// POD screen title
  ///
  /// In en, this message translates to:
  /// **'Proof of Delivery'**
  String get proofOfDelivery;

  /// Upload POD button
  ///
  /// In en, this message translates to:
  /// **'Upload POD'**
  String get uploadPod;

  /// Take photo button
  ///
  /// In en, this message translates to:
  /// **'Take Photo'**
  String get takePhoto;

  /// From gallery button
  ///
  /// In en, this message translates to:
  /// **'From Gallery'**
  String get fromGallery;

  /// Upload photos button with count
  ///
  /// In en, this message translates to:
  /// **'Upload {count} Photo(s)'**
  String uploadPhotos(int count);

  /// Uploading state text
  ///
  /// In en, this message translates to:
  /// **'Uploading...'**
  String get uploading;

  /// Upload success message
  ///
  /// In en, this message translates to:
  /// **'Upload successful'**
  String get uploadSuccess;

  /// Upload failed message
  ///
  /// In en, this message translates to:
  /// **'Upload failed'**
  String get uploadFailed;

  /// GPS tracking setting
  ///
  /// In en, this message translates to:
  /// **'GPS Tracking'**
  String get gpsTracking;

  /// GPS tracking description
  ///
  /// In en, this message translates to:
  /// **'Enable real-time location tracking during trips'**
  String get gpsTrackingDescription;

  /// Push notifications setting
  ///
  /// In en, this message translates to:
  /// **'Push Notifications'**
  String get pushNotifications;

  /// Push notifications description
  ///
  /// In en, this message translates to:
  /// **'Receive alerts for loads, trips, and payments'**
  String get pushNotificationsDescription;

  /// Language setting
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// English language option
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get english;

  /// Amharic language option
  ///
  /// In en, this message translates to:
  /// **'Amharic'**
  String get amharic;

  /// Dark mode setting
  ///
  /// In en, this message translates to:
  /// **'Dark Mode'**
  String get darkMode;

  /// Account section title
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get account;

  /// Edit profile button
  ///
  /// In en, this message translates to:
  /// **'Edit Profile'**
  String get editProfile;

  /// Change password button
  ///
  /// In en, this message translates to:
  /// **'Change Password'**
  String get changePassword;

  /// General section title
  ///
  /// In en, this message translates to:
  /// **'General'**
  String get general;

  /// About section title
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get about;

  /// Version label
  ///
  /// In en, this message translates to:
  /// **'Version'**
  String get version;

  /// Privacy policy link
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get privacyPolicy;

  /// Terms of service link
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get termsOfService;

  /// Cancel button
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// Confirm button
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirm;

  /// Save button
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// Delete button
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// Edit button
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get edit;

  /// Retry button
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// Loading state text
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get loading;

  /// Error title
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get error;

  /// Success title
  ///
  /// In en, this message translates to:
  /// **'Success'**
  String get success;

  /// Generic error message
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get somethingWentWrong;

  /// No internet error
  ///
  /// In en, this message translates to:
  /// **'No internet connection'**
  String get noInternetConnection;

  /// Timeout error
  ///
  /// In en, this message translates to:
  /// **'Connection timeout'**
  String get connectionTimeout;

  /// Plate number field label
  ///
  /// In en, this message translates to:
  /// **'Plate Number'**
  String get plateNumber;

  /// Truck type field label
  ///
  /// In en, this message translates to:
  /// **'Truck Type'**
  String get truckType;

  /// Capacity field label
  ///
  /// In en, this message translates to:
  /// **'Capacity'**
  String get capacity;

  /// Available status
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get available;

  /// Unavailable status
  ///
  /// In en, this message translates to:
  /// **'Unavailable'**
  String get unavailable;

  /// On trip status
  ///
  /// In en, this message translates to:
  /// **'On Trip'**
  String get onTrip;

  /// View details button
  ///
  /// In en, this message translates to:
  /// **'View Details'**
  String get viewDetails;

  /// Request load button
  ///
  /// In en, this message translates to:
  /// **'Request Load'**
  String get requestLoad;

  /// Request truck button
  ///
  /// In en, this message translates to:
  /// **'Request Truck'**
  String get requestTruck;

  /// Accept request button
  ///
  /// In en, this message translates to:
  /// **'Accept Request'**
  String get acceptRequest;

  /// Reject request button
  ///
  /// In en, this message translates to:
  /// **'Reject Request'**
  String get rejectRequest;

  /// Pending requests title
  ///
  /// In en, this message translates to:
  /// **'Pending Requests'**
  String get pendingRequests;

  /// Load requests navigation
  ///
  /// In en, this message translates to:
  /// **'Load Requests'**
  String get loadRequests;

  /// Truck requests navigation
  ///
  /// In en, this message translates to:
  /// **'Truck Requests'**
  String get truckRequests;

  /// Start trip button
  ///
  /// In en, this message translates to:
  /// **'Start Trip'**
  String get startTrip;

  /// End trip button
  ///
  /// In en, this message translates to:
  /// **'End Trip'**
  String get endTrip;

  /// Track shipment button
  ///
  /// In en, this message translates to:
  /// **'Track Shipment'**
  String get trackShipment;

  /// ETA label
  ///
  /// In en, this message translates to:
  /// **'Estimated Arrival'**
  String get estimatedArrival;

  /// Trip progress label
  ///
  /// In en, this message translates to:
  /// **'Trip Progress'**
  String get tripProgress;

  /// Remaining distance label
  ///
  /// In en, this message translates to:
  /// **'Remaining Distance'**
  String get remainingDistance;

  /// Mark notification as read
  ///
  /// In en, this message translates to:
  /// **'Mark as Read'**
  String get markAsRead;

  /// Mark all notifications as read
  ///
  /// In en, this message translates to:
  /// **'Mark All as Read'**
  String get markAllAsRead;

  /// Empty notifications message
  ///
  /// In en, this message translates to:
  /// **'No notifications'**
  String get noNotifications;

  /// Today date group
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get today;

  /// Yesterday date group
  ///
  /// In en, this message translates to:
  /// **'Yesterday'**
  String get yesterday;

  /// This week date group
  ///
  /// In en, this message translates to:
  /// **'This Week'**
  String get thisWeek;

  /// Earlier date group
  ///
  /// In en, this message translates to:
  /// **'Earlier'**
  String get earlier;

  /// Coming soon message
  ///
  /// In en, this message translates to:
  /// **'Coming Soon'**
  String get comingSoon;

  /// Feature coming soon message
  ///
  /// In en, this message translates to:
  /// **'This feature is coming soon!'**
  String get featureComingSoon;

  /// Logout confirmation title
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logoutConfirmTitle;

  /// Logout confirmation message
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to logout?'**
  String get logoutConfirmMessage;

  /// Refreshing state
  ///
  /// In en, this message translates to:
  /// **'Refreshing...'**
  String get refreshing;

  /// Pull to refresh hint
  ///
  /// In en, this message translates to:
  /// **'Pull to refresh'**
  String get pullToRefresh;

  /// Filter by label
  ///
  /// In en, this message translates to:
  /// **'Filter by'**
  String get filterBy;

  /// Sort by label
  ///
  /// In en, this message translates to:
  /// **'Sort by'**
  String get sortBy;

  /// All filter option
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get all;

  /// Active filter option
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get active;

  /// Completed filter option
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get completed;

  /// Shipper role
  ///
  /// In en, this message translates to:
  /// **'Shipper'**
  String get shipper;

  /// Carrier role
  ///
  /// In en, this message translates to:
  /// **'Carrier'**
  String get carrier;

  /// Driver role
  ///
  /// In en, this message translates to:
  /// **'Driver'**
  String get driver;

  /// Select role prompt
  ///
  /// In en, this message translates to:
  /// **'Select Role'**
  String get selectRole;

  /// Full name field label
  ///
  /// In en, this message translates to:
  /// **'Full Name'**
  String get fullName;

  /// Phone number field label
  ///
  /// In en, this message translates to:
  /// **'Phone Number'**
  String get phoneNumber;

  /// Company name field label
  ///
  /// In en, this message translates to:
  /// **'Company Name'**
  String get companyName;

  /// Trade license field label
  ///
  /// In en, this message translates to:
  /// **'Trade License'**
  String get tradeLicense;

  /// Kilometers abbreviation
  ///
  /// In en, this message translates to:
  /// **'km'**
  String get km;

  /// Ton unit
  ///
  /// In en, this message translates to:
  /// **'ton'**
  String get ton;

  /// Tons unit plural
  ///
  /// In en, this message translates to:
  /// **'tons'**
  String get tons;

  /// Ethiopian Birr currency code
  ///
  /// In en, this message translates to:
  /// **'ETB'**
  String get etb;

  /// Account verification screen title
  ///
  /// In en, this message translates to:
  /// **'Account Verification'**
  String get accountVerification;

  /// Verification progress label
  ///
  /// In en, this message translates to:
  /// **'Progress'**
  String get verificationProgress;

  /// Verification steps section title
  ///
  /// In en, this message translates to:
  /// **'Verification Steps'**
  String get verificationSteps;

  /// Account created step
  ///
  /// In en, this message translates to:
  /// **'Account Created'**
  String get stepAccountCreated;

  /// Documents uploaded step
  ///
  /// In en, this message translates to:
  /// **'Documents Uploaded'**
  String get stepDocumentsUploaded;

  /// Admin review step
  ///
  /// In en, this message translates to:
  /// **'Admin Review'**
  String get stepAdminReview;

  /// Account activated step
  ///
  /// In en, this message translates to:
  /// **'Account Activated'**
  String get stepAccountActivated;

  /// Registration complete status
  ///
  /// In en, this message translates to:
  /// **'Registration Complete'**
  String get statusRegistrationComplete;

  /// Under review status
  ///
  /// In en, this message translates to:
  /// **'Under Review'**
  String get statusUnderReview;

  /// In progress indicator
  ///
  /// In en, this message translates to:
  /// **'In Progress'**
  String get inProgress;

  /// Upload documents button
  ///
  /// In en, this message translates to:
  /// **'Upload Documents'**
  String get uploadDocuments;

  /// Awaiting review status
  ///
  /// In en, this message translates to:
  /// **'Awaiting Review'**
  String get awaitingReview;

  /// Documents being reviewed message
  ///
  /// In en, this message translates to:
  /// **'Your documents are being reviewed. This usually takes 1-2 business days.'**
  String get documentsBeingReviewed;

  /// Upload documents prompt
  ///
  /// In en, this message translates to:
  /// **'Please upload your verification documents to continue.'**
  String get uploadVerificationDocuments;

  /// Estimated review time label
  ///
  /// In en, this message translates to:
  /// **'Estimated review time'**
  String get estimatedReviewTime;

  /// 1-2 business days estimate
  ///
  /// In en, this message translates to:
  /// **'1-2 business days'**
  String get oneToTwoBusinessDays;

  /// Contact support button
  ///
  /// In en, this message translates to:
  /// **'Contact Support'**
  String get contactSupport;

  /// Verification pending status
  ///
  /// In en, this message translates to:
  /// **'Verification Pending'**
  String get verificationPending;

  /// Account pending verification message
  ///
  /// In en, this message translates to:
  /// **'Your account is pending verification'**
  String get accountPendingVerification;

  /// Limited access message
  ///
  /// In en, this message translates to:
  /// **'You have limited access until your account is verified.'**
  String get limitedAccessMessage;

  /// Dashboard navigation label
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get dashboard;

  /// Find loads navigation label
  ///
  /// In en, this message translates to:
  /// **'Find Loads'**
  String get findLoads;

  /// Post trucks navigation label
  ///
  /// In en, this message translates to:
  /// **'Post Trucks'**
  String get postTrucks;

  /// My loads navigation label
  ///
  /// In en, this message translates to:
  /// **'My Loads'**
  String get myLoads;

  /// My trucks navigation label
  ///
  /// In en, this message translates to:
  /// **'My Trucks'**
  String get myTrucks;

  /// My trips navigation label
  ///
  /// In en, this message translates to:
  /// **'My Trips'**
  String get myTrips;

  /// Find trucks navigation label
  ///
  /// In en, this message translates to:
  /// **'Find Trucks'**
  String get findTrucks;

  /// Track navigation label
  ///
  /// In en, this message translates to:
  /// **'Track'**
  String get track;

  /// Shipments navigation label
  ///
  /// In en, this message translates to:
  /// **'Shipments'**
  String get shipments;

  /// Truck bookings navigation label
  ///
  /// In en, this message translates to:
  /// **'Truck Bookings'**
  String get truckBookings;

  /// Track map navigation label
  ///
  /// In en, this message translates to:
  /// **'Track Map'**
  String get trackMap;

  /// Post new load navigation label
  ///
  /// In en, this message translates to:
  /// **'Post New Load'**
  String get postNewLoad;

  /// My shipments navigation label
  ///
  /// In en, this message translates to:
  /// **'My Shipments'**
  String get myShipments;

  /// My truck requests navigation label
  ///
  /// In en, this message translates to:
  /// **'My Truck Requests'**
  String get myTruckRequests;

  /// Track shipments navigation label
  ///
  /// In en, this message translates to:
  /// **'Track Shipments'**
  String get trackShipments;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['am', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'am':
      return AppLocalizationsAm();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
