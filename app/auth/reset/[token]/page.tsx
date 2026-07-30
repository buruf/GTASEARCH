import type { Metadata } from "next";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  return (
    <div className="px-4 pb-16">
      <ResetForm token={params.token} />
    </div>
  );
}
