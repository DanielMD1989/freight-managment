"use client";

interface Props {
  userEmail: string;
}

export function AccountSuspendedClient({ userEmail }: Props) {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-8 py-6 text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Account Suspended</h1>
            <p className="text-sm text-orange-100">{userEmail}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        <p className="text-slate-600">
          Your account has been suspended by an administrator. You cannot access
          the platform while your account is suspended.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          If you believe this is an error, please contact our support team for
          assistance.
        </p>
      </div>

      {/* Actions */}
      <div className="border-t border-slate-100 bg-slate-50 px-8 py-6">
        <div className="flex flex-col gap-3">
          <a
            href="mailto:support@freightflow.app"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Contact Support
          </a>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
