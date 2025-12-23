import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-4xl px-4 text-center">
        <h1 className="mb-4 text-5xl font-bold text-gray-900">
          Freight Management Platform
        </h1>
        <p className="mb-8 text-xl text-gray-600">
          Connect shippers and carriers for efficient freight transportation in
          Ethiopia
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-500"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-md border-2 border-blue-600 px-6 py-3 text-base font-semibold text-blue-600 hover:bg-blue-50"
          >
            Register
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              For Shippers
            </h3>
            <p className="text-gray-600">
              Post loads, find carriers, and track deliveries in real-time
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              For Carriers
            </h3>
            <p className="text-gray-600">
              Find loads, manage your fleet, and grow your business
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              GPS Tracking
            </h3>
            <p className="text-gray-600">
              Real-time GPS tracking for complete visibility
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
