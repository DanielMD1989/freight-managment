"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearCSRFToken } from "@/lib/csrfFetch";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      // Clear CSRF token cache on logout
      clearCSRFToken();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-gray-400"
    >
      {isLoading ? "Logging out..." : "Logout"}
    </button>
  );
}
