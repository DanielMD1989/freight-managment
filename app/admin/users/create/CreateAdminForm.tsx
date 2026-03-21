"use client";

/**
 * Create Admin Form
 *
 * G-SA1-1: Form for SUPER_ADMIN to create new Admin accounts.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateAdminForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Fetch CSRF token
      const csrfRes = await fetch("/api/csrf-token");
      const csrfData = await csrfRes.json();

      const payload: Record<string, string> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
      };
      if (formData.phone.trim()) {
        payload.phone = formData.phone.trim();
      }

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData.token,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to create admin account");
        return;
      }

      router.push("/admin/users?created=true");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";
  const labelClass = "mb-1 block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className={labelClass}>
            First Name *
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            value={formData.firstName}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="lastName" className={labelClass}>
            Last Name *
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            value={formData.lastName}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Email *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="phone" className={labelClass}>
          Phone (optional)
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          placeholder="+251..."
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>
          Password *
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          value={formData.password}
          onChange={handleChange}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
        <p className="text-sm text-blue-800">
          The new account will be created with the <strong>Admin</strong> role
          and will be active immediately.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push("/admin/users")}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </div>
    </form>
  );
}
