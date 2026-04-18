"use client";

import { useState } from "react";
import Link from "next/link";

export default function InviteDriverClient() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    inviteCode: string;
    expiresAt: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const csrf = await fetch("/api/csrf-token", {
        credentials: "include",
      }).then((r) => r.json());

      // /api/csrf-token returns { csrfToken, expiresIn, fresh }.
      // Fall back to csrf.token for forward-compat with older responses.
      const csrfToken = csrf.csrfToken ?? csrf.token;

      const res = await fetch("/api/drivers/invite", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          name,
          phone,
          ...(email && { email }),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create invitation");
      }

      setResult({
        inviteCode: data.inviteCode,
        expiresAt: data.expiresAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invitation failed");
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (result?.inviteCode) {
      navigator.clipboard.writeText(result.inviteCode);
    }
  }

  if (result) {
    return (
      <div className="space-y-6">
        <Link
          href="/carrier/drivers"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; Back to Drivers
        </Link>

        <div className="rounded-xl bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
              <svg
                className="h-7 w-7 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              Driver Invited Successfully
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Share this code with your driver to complete registration
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 p-6 text-center">
            <p className="mb-1 text-xs font-semibold tracking-wider text-indigo-500 uppercase">
              Invite Code
            </p>
            <p className="font-mono text-4xl font-bold tracking-widest text-indigo-700">
              {result.inviteCode}
            </p>
            <button
              onClick={copyCode}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy to Clipboard
            </button>
            <p className="mt-3 text-xs text-slate-500">
              Expires:{" "}
              {new Date(result.expiresAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="mb-1 text-xs font-semibold text-slate-600">
              How it works
            </p>
            <ol className="space-y-1 text-xs text-slate-500">
              <li>1. Driver downloads the FreightET Driver app</li>
              <li>2. They enter this invite code + their phone number</li>
              <li>3. You approve them from the Pending tab</li>
            </ol>
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => {
                setResult(null);
                setName("");
                setPhone("");
                setEmail("");
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Invite Another
            </button>
            <Link
              href="/carrier/drivers"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Back to Driver List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/carrier/drivers"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Back to Drivers
      </Link>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/25">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Invite a Driver
            </h2>
            <p className="text-sm text-slate-500">
              Generate an invite code for a new driver to join your organization
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              placeholder="e.g. Abebe Kebede"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              maxLength={20}
              placeholder="e.g. +251912345678"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Email{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="driver@example.com"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim() || !phone.trim()}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating Invite..." : "Generate Invite Code"}
          </button>
        </form>
      </div>
    </div>
  );
}
