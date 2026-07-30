"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CategoryIcon } from "@/components/CategoryIcon";
import { saveCategory } from "./actions";
import type { FormState } from "@/app/auth/actions";

interface Subcategory {
  slug: string;
  label: string;
}

interface Category {
  slug: string;
  label: string;
  icon: string;
  subcategories: Subcategory[];
}

const button = "mt-5 h-11 w-full rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={button}>{pending ? "Please wait…" : "Continue"}</button>;
}

export function CategoryForm({
  categories, defaultCategory, defaultSubcategory,
}: {
  categories: Category[];
  defaultCategory: string;
  defaultSubcategory: string;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(saveCategory, { ok: false });
  const [selected, setSelected] = useState(defaultCategory);
  const activeCategory = categories.find((c) => c.slug === selected);

  return (
    <form action={formAction} className="mt-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map((c) => (
          <label key={c.slug} className="relative block cursor-pointer">
            <input
              type="radio"
              name="category"
              value={c.slug}
              defaultChecked={c.slug === defaultCategory}
              onChange={() => setSelected(c.slug)}
              className="peer sr-only"
            />
            <div className="flex flex-col items-center gap-1.5 rounded-card border border-line px-2 py-3 text-center text-xs font-medium text-ink-muted peer-checked:border-brand peer-checked:ring-2 peer-checked:ring-brand peer-checked:text-brand">
              <CategoryIcon name={c.icon} className="h-6 w-6" />
              {c.label}
            </div>
          </label>
        ))}
      </div>

      {activeCategory && activeCategory.subcategories.length > 0 && (
        <>
          <label className="mt-4 block text-sm font-medium text-ink" htmlFor="subcategory">
            Subcategory (optional)
          </label>
          <select
            id="subcategory"
            name="subcategory"
            defaultValue={activeCategory.slug === defaultCategory ? defaultSubcategory : ""}
            key={activeCategory.slug}
            className="mt-1 h-11 w-full rounded-btn border border-line bg-surface px-3 text-sm focus:border-brand"
          >
            <option value="">Choose a subcategory…</option>
            {activeCategory.subcategories.map((s) => (
              <option key={s.slug} value={s.slug}>{s.label}</option>
            ))}
          </select>
        </>
      )}

      {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}

      <Submit />
    </form>
  );
}
