import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForms } from "@/components/AuthForms";
import { googleEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <div className="px-4 pb-16">
      <Suspense>
        <AuthForms tab="signin" googleOn={googleEnabled()} />
      </Suspense>
    </div>
  );
}
