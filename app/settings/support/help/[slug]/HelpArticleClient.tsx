"use client";

/**
 * HelpArticleClient — §14 Help Documentation Topics
 *
 * Renders help content for each topic. Content is structured per Blueprint §14:
 *   - Getting Started: account setup, document upload, verification process
 *   - Posting Loads: load creation, status tabs, matching, requesting trucks
 *   - GPS Tracking: device setup, IMEI registration, live tracking, signal loss
 *   - Payments & Settlements: wallet top-up, service fees, corridor rates, settlement process
 */

import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertTriangle, Info } from "lucide-react";

interface HelpArticleClientProps {
  slug: string;
  userRole: string;
}

interface HelpSection {
  title: string;
  content: string[];
  type?: "info" | "warning" | "steps";
}

interface HelpTopic {
  title: string;
  description: string;
  sections: HelpSection[];
}

const HELP_CONTENT: Record<string, HelpTopic> = {
  "getting-started": {
    title: "Getting Started",
    description:
      "Learn how to set up your account, upload required documents, and get verified to start using the platform.",
    sections: [
      {
        title: "1. Create Your Account",
        type: "steps",
        content: [
          "Go to the registration page and select your role: Shipper (to post loads) or Carrier (to register trucks).",
          "Fill in your details: name, email, phone number, and create a secure password.",
          "You will receive an OTP (One-Time Password) via SMS or email to verify your account.",
          "Enter the OTP to complete registration. Your account status will be set to REGISTERED.",
        ],
      },
      {
        title: "2. Upload Required Documents",
        type: "steps",
        content: [
          "After registration, navigate to your Documents section.",
          "Upload all required business documents: trade license, TIN certificate, and any industry-specific permits.",
          "For Carriers: you will also need to upload vehicle-related documents when registering trucks.",
          "Ensure all documents are clear, legible, and not expired. Blurry or expired documents will be rejected.",
          "Once uploaded, your status changes to PENDING_VERIFICATION.",
        ],
      },
      {
        title: "3. Verification & Approval",
        type: "steps",
        content: [
          "An Admin will review your uploaded documents. This typically takes 1-2 business days.",
          "If approved: your status becomes ACTIVE and you gain full marketplace access.",
          "If rejected: you will see the specific rejection reason. Fix the issues and re-upload your documents.",
          "You can resubmit as many times as needed until approved.",
        ],
      },
      {
        title: "Important Notes",
        type: "warning",
        content: [
          "You cannot access the marketplace (search loads, post trucks, send requests) until your account is ACTIVE.",
          "After approval, your documents are permanently locked and cannot be edited. Contact support if you need to update approved documents.",
          "Your wallet must have a minimum balance before you can perform marketplace actions (searching, matching, requesting).",
        ],
      },
      {
        title: "Account Roles",
        type: "info",
        content: [
          "Shipper: Posts loads that need to be transported. Can search for available trucks and send transport requests.",
          "Carrier: Registers trucks and posts them to the marketplace. Can search for available loads and send requests to shippers.",
          "Dispatcher: Platform operator created by Admin. Can view all loads, trucks, and trips across the platform and propose matches.",
        ],
      },
    ],
  },

  "posting-loads": {
    title: "Posting Loads",
    description:
      "How to create loads, understand load statuses, find matching trucks, and manage transport requests.",
    sections: [
      {
        title: "Creating a Load",
        type: "steps",
        content: [
          "Navigate to the Loads section and click 'Post New Load'.",
          "Fill in the required details: pickup city, delivery city, cargo description, weight, and truck type needed.",
          "Specify the pickup and delivery dates/windows.",
          "Add any special requirements (e.g., refrigerated, hazmat, insurance requirements).",
          "Save as Draft (private) or Post directly to the marketplace (visible to carriers).",
        ],
      },
      {
        title: "Load Status Lifecycle",
        type: "info",
        content: [
          "DRAFT — Load created but not visible on the marketplace. Only you can see it.",
          "POSTED — Load is live on the marketplace. Carriers can find and request it.",
          "SEARCHING / OFFERED — You are actively looking for a truck or have sent a request to a carrier.",
          "ASSIGNED — A carrier has accepted. Both the load and the assigned truck are removed from the marketplace.",
          "PICKUP_PENDING — The carrier is on their way to pick up your cargo.",
          "IN_TRANSIT — Your cargo has been picked up and is being transported.",
          "DELIVERED — The carrier has delivered your cargo. Awaiting proof of delivery (POD) confirmation.",
          "COMPLETED — POD confirmed, service fees processed. Trip is finalized.",
        ],
      },
      {
        title: "Finding Matching Trucks",
        type: "steps",
        content: [
          "From a posted load, click 'Find Trucks' to search for matching carriers.",
          "The system matches based on: truck type compatibility, pickup location within the truck's deadhead-origin (DH-O) radius, and delivery location within the truck's deadhead-destination (DH-D) radius.",
          "Only trucks that meet BOTH radius conditions are shown. Trucks on active trips are excluded.",
          "Review the carrier's profile, rating, and truck details before sending a request.",
          "Send a request — the carrier receives a notification and can accept or reject.",
        ],
      },
      {
        title: "Handling Requests",
        type: "info",
        content: [
          "When a Carrier requests your load: you will receive a notification. Review their profile and truck details, then accept or reject.",
          "When you request a Carrier's truck: wait for their response. If they accept, you get a final confirmation step.",
          "After acceptance: the load moves to ASSIGNED and a trip is created. Both load and truck are removed from the marketplace.",
          "If rejected: you can search for and request another truck.",
        ],
      },
      {
        title: "Cancellation Rules",
        type: "warning",
        content: [
          "You can cancel a load in DRAFT, POSTED, SEARCHING, OFFERED, ASSIGNED, or PICKUP_PENDING status.",
          "Cancelling an ASSIGNED or PICKUP_PENDING load will also cancel the linked trip and free the truck.",
          "You CANNOT cancel a load that is IN_TRANSIT — the cargo is on the truck. You must raise an Exception first.",
          "You CANNOT cancel a DELIVERED or COMPLETED load.",
        ],
      },
    ],
  },

  "gps-tracking": {
    title: "GPS Tracking",
    description:
      "How to set up GPS devices, register IMEI numbers, track shipments in real-time, and handle signal loss.",
    sections: [
      {
        title: "GPS Sources",
        type: "info",
        content: [
          "Primary: Hardware device (ELD/telematics) plugged into the truck's OBD port. Sends data automatically and continuously.",
          "Fallback: Mobile app GPS from the carrier's phone. Used when no hardware device is available.",
          "The platform prioritizes hardware GPS data when both sources are available.",
        ],
      },
      {
        title: "Setting Up a GPS Device",
        type: "steps",
        content: [
          "Install the GPS/ELD hardware device in your truck (OBD port connection).",
          "Note the device's IMEI number — this is printed on the device or available in the device settings.",
          "In the platform, go to your Truck details and click 'Register GPS Device'.",
          "Enter the IMEI number and device type. The system will verify the format.",
          "Once registered, the device status will show as ACTIVE.",
        ],
      },
      {
        title: "GPS Requirement for Marketplace",
        type: "warning",
        content: [
          "GPS is NOT required for truck approval — Admin approves trucks based on documents only.",
          "GPS IS required for posting a truck to the marketplace. If no active GPS device is registered, posting is blocked.",
          "You will see the message: 'Register a GPS device before posting your truck.'",
          "Existing truck approvals are never invalidated if GPS is removed later.",
        ],
      },
      {
        title: "Live Tracking During Trips",
        type: "info",
        content: [
          "Once a trip is IN_TRANSIT, the shipper can see the truck's real-time location on the map.",
          "GPS positions are updated at regular intervals (typically every 30-60 seconds for hardware devices).",
          "The shipper has NO GPS access before the trip starts or on any truck not assigned to their load.",
          "After trip completion (COMPLETED), the full route from pickup to delivery is available as route history.",
        ],
      },
      {
        title: "Distance Calculation & Billing",
        type: "info",
        content: [
          "At trip completion, the total distance is calculated from GPS positions using Haversine formula.",
          "If GPS data exists: the actual trip distance is used for service fee calculation.",
          "If no GPS data: the system falls back to the planned corridor distance, and Admin is notified.",
          "Distance is never estimated silently — the billing source (GPS vs. corridor) is always recorded.",
        ],
      },
      {
        title: "Signal Loss",
        type: "warning",
        content: [
          "Trips are NEVER blocked due to GPS signal loss — operational continuity comes first.",
          "When a truck on an active trip loses signal, Admin and Dispatcher are notified.",
          "At trip completion with no GPS data, the corridor distance is used as fallback and Admin receives an alert.",
          "If you experience persistent signal loss, check: device power connection, antenna placement, and cellular coverage in the area.",
        ],
      },
    ],
  },

  "payments-settlements": {
    title: "Payments & Settlements",
    description:
      "How the wallet system works, top-up methods, service fee calculation, and the settlement process.",
    sections: [
      {
        title: "How the Service Fee Works",
        type: "info",
        content: [
          "The platform charges a service fee per kilometer for facilitating the connection between shipper and carrier.",
          "Shippers and carriers negotiate their own transport rates directly — the platform does not set transport prices.",
          "Each party (shipper and carrier) has their own configurable rate per kilometer, set by the platform admin.",
          "Service Fee = Rate/km x Total KM traveled. This is calculated after trip completion with GPS distance data.",
          "Fees are deducted from your wallet balance automatically after trip completion and POD confirmation.",
        ],
      },
      {
        title: "Wallet Top-Up Methods",
        type: "steps",
        content: [
          "Bank Transfer Slip: Transfer funds to the platform bank account, then upload the transfer slip. Admin verifies and credits your wallet.",
          "Telebirr: Use the Telebirr mobile money platform to send payment. Reference your account ID in the transfer.",
          "M-Pesa: Available for cross-border transactions. Send payment via M-Pesa with your account reference.",
          "After payment, go to Wallet > Request Top-Up, enter the amount and upload proof of payment.",
          "Admin reviews and approves the deposit. You will receive a notification when your wallet is credited.",
        ],
      },
      {
        title: "Wallet Minimum Balance",
        type: "warning",
        content: [
          "A minimum wallet balance is required to use the marketplace. If your balance falls below the threshold, ALL marketplace activity is blocked.",
          "When blocked, you cannot: search loads/trucks, send or receive requests, match with other parties, or start trips.",
          "The minimum balance threshold is set by the platform admin and may vary.",
          "Top up your wallet promptly to avoid being blocked from active marketplace operations.",
        ],
      },
      {
        title: "Settlement Process",
        type: "steps",
        content: [
          "After a trip reaches DELIVERED status, one of three completion paths triggers settlement:",
          "1. Carrier uploads Proof of Delivery (POD) — photo/document evidence of delivery.",
          "2. Shipper confirms delivery — taps 'Confirm Delivery' on the trip. No POD required.",
          "3. Auto-close after 48 hours — if neither party acts within 48 hours of DELIVERED, the system auto-closes.",
          "Once completed: service fees are calculated based on actual GPS distance (or corridor distance as fallback).",
          "Fees are deducted from both shipper's and carrier's wallets. Revenue = Shipper Fee + Carrier Fee.",
          "If fee deduction fails (insufficient balance), Admin is notified for manual resolution.",
        ],
      },
      {
        title: "Viewing Your Financial Summary",
        type: "info",
        content: [
          "Go to your Dashboard to see: wallet balance, total service fees paid, and recent transactions.",
          "Each completed trip shows the fee breakdown: rate/km used, total km, and amount deducted.",
          "Contact support if you see a discrepancy in any fee calculation.",
        ],
      },
      {
        title: "Important Notes",
        type: "warning",
        content: [
          "Transport payment (the amount the shipper pays the carrier for the actual transport) is settled outside the platform between the parties directly.",
          "The platform only deducts service fees — it does not intermediate the transport payment.",
          "Late POD upload only affects the timing of service fee calculation, not the fee amount.",
          "Promotional rates may be applied to your account — check with Admin for available promotions.",
        ],
      },
    ],
  },
};

export default function HelpArticleClient({
  slug,
  userRole: _userRole,
}: HelpArticleClientProps) {
  const topic = HELP_CONTENT[slug];

  if (!topic) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Help topic not found.</p>
        <Link
          href="/settings/support"
          className="mt-4 inline-block text-sm text-teal-600 hover:underline"
        >
          Back to Help & Support
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Back link */}
      <Link
        href="/settings/support"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-teal-600 dark:text-gray-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Help & Support
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {topic.title}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {topic.description}
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {topic.sections.map((section, i) => (
          <div key={i}>
            <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
              {section.title}
            </h3>

            {section.type === "steps" && (
              <ol className="space-y-2.5">
                {section.content.map((step, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                      {j + 1}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {section.type === "info" && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400">
                    Information
                  </span>
                </div>
                <ul className="space-y-2">
                  {section.content.map((item, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-200"
                    >
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {section.type === "warning" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                    Important
                  </span>
                </div>
                <ul className="space-y-2">
                  {section.content.map((item, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!section.type && (
              <ul className="space-y-1.5">
                {section.content.map((item, j) => (
                  <li
                    key={j}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-10 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Still need help? Contact us at{" "}
          <a
            href="mailto:support@freightet.com"
            className="font-medium text-teal-600 hover:underline"
          >
            support@freightet.com
          </a>{" "}
          or call{" "}
          <a
            href="tel:+251911123456"
            className="font-medium text-teal-600 hover:underline"
          >
            +251 911 123 456
          </a>
        </p>
      </div>
    </div>
  );
}
