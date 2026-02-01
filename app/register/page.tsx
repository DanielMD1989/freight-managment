"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Association {
  id: string;
  name: string;
}

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    role: "SHIPPER",
    companyName: "",
    carrierType: "CARRIER_COMPANY",
    associationId: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [associations, setAssociations] = useState<Association[]>([]);

  useEffect(() => {
    if (formData.role === "CARRIER" && formData.carrierType === "CARRIER_INDIVIDUAL") {
      fetch("/api/associations")
        .then((res) => res.json())
        .then((data) => {
          if (data.associations) {
            setAssociations(data.associations);
          }
        })
        .catch(() => {});
    }
  }, [formData.role, formData.carrierType]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          phone: formData.phone || undefined,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          companyName: formData.companyName || undefined,
          carrierType: formData.role === "CARRIER" ? formData.carrierType : undefined,
          associationId: formData.associationId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details && Array.isArray(data.details)) {
          const errorMessages = data.details.map((detail: any) => detail.message).join(", ");
          throw new Error(errorMessages);
        }
        throw new Error(data.error || "Registration failed");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClassName = "block w-full rounded-xl border-0 px-4 py-3 text-slate-900 dark:text-white bg-white dark:bg-slate-900 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 dark:focus:ring-primary-500 transition-all text-sm";
  const labelClassName = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2";
  const selectClassName = "block w-full rounded-xl border-0 px-4 py-3 text-slate-900 dark:text-white bg-white dark:bg-slate-900 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-primary-600 dark:focus:ring-primary-500 transition-all text-sm";

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Brand */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-600/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-center px-12">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">FreightET</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-6 leading-tight">
            Join Ethiopia&apos;s<br/>
            <span className="text-primary-400">Largest Freight Network</span>
          </h1>

          <p className="text-base text-slate-300 mb-8 max-w-sm">
            Whether you&apos;re shipping goods or hauling freight, we&apos;ve got you covered.
          </p>

          {/* Benefits */}
          <div className="space-y-4">
            {[
              { title: "For Shippers", desc: "Find reliable carriers instantly" },
              { title: "For Carriers", desc: "Get matched with profitable loads" },
              { title: "For All", desc: "Track shipments in real-time" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-accent-500/30 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-medium">{item.title}</div>
                  <div className="text-slate-400 text-sm">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Registration Form */}
      <div className="w-full lg:w-7/12 flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-lg">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">FreightET</span>
          </div>

          <div className="text-center lg:text-left mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create your account
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Get started in just a few minutes
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className={labelClassName}>First Name</label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className={inputClassName}
                  placeholder="John"
                />
              </div>
              <div>
                <label htmlFor="lastName" className={labelClassName}>Last Name</label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className={inputClassName}
                  placeholder="Doe"
                />
              </div>
            </div>

            {/* Contact Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className={labelClassName}>Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputClassName}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="phone" className={labelClassName}>Phone (optional)</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={inputClassName}
                  placeholder="+251 9XX XXX XXX"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className={labelClassName}>I am a</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, companyName: "", carrierType: "CARRIER_COMPANY", associationId: "" })}
                className={selectClassName}
              >
                <option value="SHIPPER">Shipper - I need to ship goods</option>
                <option value="CARRIER">Carrier - I transport goods</option>
                <option value="LOGISTICS_AGENT">Logistics Agent (3PL)</option>
                <option value="DRIVER">Driver</option>
              </select>
            </div>

            {/* Company Name for Shippers */}
            {formData.role === "SHIPPER" && (
              <div>
                <label htmlFor="companyName" className={labelClassName}>Company Name</label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Your company name"
                  className={inputClassName}
                />
              </div>
            )}

            {/* Carrier Type Selection */}
            {formData.role === "CARRIER" && (
              <>
                <div>
                  <label htmlFor="carrierType" className={labelClassName}>Carrier Type</label>
                  <select
                    id="carrierType"
                    name="carrierType"
                    value={formData.carrierType}
                    onChange={(e) => setFormData({ ...formData, carrierType: e.target.value, associationId: "" })}
                    className={selectClassName}
                  >
                    <option value="CARRIER_COMPANY">Trucking Company (multiple trucks)</option>
                    <option value="CARRIER_INDIVIDUAL">Single Truck Owner</option>
                    <option value="FLEET_OWNER">Fleet Owner (independent)</option>
                  </select>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {formData.carrierType === "CARRIER_COMPANY" && "A trucking company with multiple trucks under management"}
                    {formData.carrierType === "CARRIER_INDIVIDUAL" && "An owner-operator with a single truck, may join an association"}
                    {formData.carrierType === "FLEET_OWNER" && "An independent fleet operator with multiple owned trucks"}
                  </p>
                </div>

                <div>
                  <label htmlFor="companyName" className={labelClassName}>
                    {formData.carrierType === "CARRIER_INDIVIDUAL" ? "Your Name / Business Name" : "Company / Fleet Name"}
                  </label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder={formData.carrierType === "CARRIER_INDIVIDUAL" ? "Your name or business name" : "Company or fleet name"}
                    className={inputClassName}
                  />
                </div>

                {formData.carrierType === "CARRIER_INDIVIDUAL" && (
                  <div>
                    <label htmlFor="associationId" className={labelClassName}>Association Membership (Optional)</label>
                    <select
                      id="associationId"
                      name="associationId"
                      value={formData.associationId}
                      onChange={(e) => setFormData({ ...formData, associationId: e.target.value })}
                      className={selectClassName}
                    >
                      <option value="">No association (Independent)</option>
                      {associations.map((assoc) => (
                        <option key={assoc.id} value={assoc.id}>{assoc.name}</option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      If you belong to a carrier association, select it here
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Password Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className={labelClassName}>Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={inputClassName}
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className={labelClassName}>Confirm Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={inputClassName}
                  placeholder="Confirm password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3.5 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-primary-700 shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating account...
                </span>
              ) : (
                "Create account"
              )}
            </button>

            <div className="text-center pt-4">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
                  Sign in
                </Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
