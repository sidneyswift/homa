"use client";

import { useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

export type QuietChoiceType = "radio" | "checkbox";
export type QuietChoiceValue = string | readonly string[];

export type QuietChoiceOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

export type QuietChoiceProps = {
  name: string;
  label: ReactNode;
  options: readonly QuietChoiceOption[];
  type?: QuietChoiceType;
  value?: QuietChoiceValue;
  defaultValue?: QuietChoiceValue;
  onChange?: (value: QuietChoiceValue) => void;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  state?: "idle" | "loading" | "success" | "error";
  className?: string;
};

function asValues(value: QuietChoiceValue | undefined): string[] {
  if (Array.isArray(value)) return [...value];
  return typeof value === "string" && value ? [value] : [];
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "option";
}

/**
 * A native fieldset and legend with a quiet, touch-sized option treatment.
 * Radio and checkbox semantics stay native, while the callback receives a
 * value that is useful to a route without deciding what that value means.
 */
export function QuietChoice({
  name,
  label,
  options,
  type = "radio",
  value,
  defaultValue,
  onChange,
  hint,
  error,
  required = false,
  disabled = false,
  state = error ? "error" : "idle",
  className = "",
}: QuietChoiceProps) {
  const [internalValue, setInternalValue] = useState<QuietChoiceValue | undefined>(defaultValue);
  const selectedValue = value === undefined ? internalValue : value;
  const selectedValues = asValues(selectedValue);
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const current = event.currentTarget.value;
    let next: QuietChoiceValue = current;
    if (type === "checkbox") {
      const nextValues = new Set(selectedValues);
      if (event.currentTarget.checked) nextValues.add(current);
      else nextValues.delete(current);
      next = [...nextValues];
    }
    if (value === undefined) setInternalValue(next);
    onChange?.(next);
  }

  return (
    <fieldset
      className={`quiet-choice ${className}`.trim()}
      data-state={state}
      data-disabled={disabled ? "true" : undefined}
      aria-busy={state === "loading" ? true : undefined}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      aria-required={required ? true : undefined}
      disabled={disabled}
    >
      <legend className="quiet-choice__legend">
        <span>{label}</span>
        {required ? <span className="quiet-choice__required" aria-hidden="true">*</span> : null}
      </legend>
      <div className="quiet-choice__options">
        {options.map((option, index) => {
          const optionId = `${slug(name)}-${slug(option.value)}-${index}`;
          const checked = selectedValues.includes(option.value);
          const optionDisabled = disabled || Boolean(option.disabled);
          return (
            <label
              className="quiet-choice__option"
              data-selected={checked ? "true" : undefined}
              data-disabled={optionDisabled ? "true" : undefined}
              htmlFor={optionId}
              key={optionId}
            >
              <input
                className="quiet-choice__input"
                id={optionId}
                name={name}
                type={type}
                value={option.value}
                checked={checked}
                disabled={optionDisabled}
                required={required && type === "radio" && index === 0}
                onChange={handleChange}
              />
              <span className="quiet-choice__copy">
                <span className="quiet-choice__label">{option.label}</span>
                {option.description ? <span className="quiet-choice__description">{option.description}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      {hint ? <p className="quiet-choice__hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="quiet-choice__error" id={errorId} role="alert">{error}</p> : null}
    </fieldset>
  );
}
