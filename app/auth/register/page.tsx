import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForms } from "@/components/AuthForms";
import { googleEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <div className="px-4 pb-16">
      <Suspense>
        <AuthForms tab="register" googleOn={googleEnabled()} />
      </Suspense>
    </div>
  );
}
