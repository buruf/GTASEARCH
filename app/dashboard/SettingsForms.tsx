"use client";

import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/wizard/SubmitButton";
import { FieldError } from "@/components/wizard/FieldError";
import { updateProfileAction, changePasswordAction } from "./actions";
import type { FormState } from "@/app/auth/actions";

const input = "h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand";
const label = "mt-3 block text-sm font-medium text-ink";

export function SettingsForms({ name, phone }: { name: string; phone: string }) {
  const [profileState, profileAction] = useFormState<FormState, FormData>(updateProfileAction, { ok: false });
  const [passwordState, passwordAction] = useFormState<FormState, FormData>(changePasswordAction, { ok: false });

  return (
    <div className="mt-4 flex flex-col gap-6 sm:flex-row">
      <form action={profileAction} className="flex-1 rounded-card border border-line bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink">Profile</h3>

        <label className={label} htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={name} required maxLength={100} className={input} />

        <label className={label} htmlFor="phone">Phone (optional)</label>
        <input id="phone" name="phone" defaultValue={phone} maxLength={20} className={input} />
        <FieldError message={profileState.error} />

        {profileState.ok && <p className="mt-3 text-sm text-green-700">Saved.</p>}
        <SubmitButton>Save profile</SubmitButton>
      </form>

      <form action={passwordAction} className="flex-1 rounded-card border border-line bg-surface p-5 shadow-card">
        <h3 className="text-sm font-semibold text-ink">Change password</h3>

        <label className={label} htmlFor="current">Current password</label>
        <input id="current" name="current" type="password" required autoComplete="current-password" className={input} />

        <label className={label} htmlFor="password">New password</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={input} />

        <label className={label} htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={input} />
        <FieldError message={passwordState.error} />

        {passwordState.ok && <p className="mt-3 text-sm text-green-700">Password changed.</p>}
        <SubmitButton>Change password</SubmitButton>
      </form>
    </div>
  );
}
