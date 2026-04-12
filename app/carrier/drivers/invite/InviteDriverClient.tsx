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

      const res = await fetch("/api/drivers/invite", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf.token,
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
      <div className="rounded-xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">&#x2705;</div>
          <h2 className="text-xl font-bold text-slate-800">
            Driver Invited Successfully
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Share this code with your driver
          </p>
        </div>

        <div className="mb-6 rounded-lg bg-indigo-50 p-6 text-center">
          <p className="mb-1 text-xs text-indigo-600 uppercase">Invite Code</p>
          <p className="font-mono text-4xl font-bold tracking-widest text-indigo-700">
            {result.inviteCode}
          </p>
          <button
            onClick={copyCode}
            className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
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

        <div className="text-center">
          <Link
            href="/carrier/drivers"
            className="text-sm text-indigo-600 hover:underline"
          >
            Back to Driver List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-8 shadow-sm">
      <div className="mb-6">
        <Link
          href="/carrier/drivers"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; Back to Drivers
        </Link>
        <h2 className="mt-2 text-xl font-bold text-slate-800">
          Invite a Driver
        </h2>
        <p className="text-sm text-slate-500">
          Generate an invite code for a new driver to join your carrier
          organization.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            placeholder="e.g. Abebe Kebede"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            maxLength={20}
            placeholder="e.g. 0912345678"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Email (optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="driver@example.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
  );
}
