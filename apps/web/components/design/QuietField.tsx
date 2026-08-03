import { cloneElement } from "react";
import type { ReactElement, ReactNode } from "react";

type QuietFieldControlProps = {
  id?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-errormessage"?: string;
  "aria-invalid"?: boolean | "false" | "true";
};

export type QuietFieldState = "idle" | "loading" | "success" | "error";

export type QuietFieldProps = {
  /** The id is applied to the supplied native input, select, or textarea. */
  id: string;
  label: ReactNode;
  children: ReactElement;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  state?: QuietFieldState;
  className?: string;
};

function joinIds(...ids: Array<string | undefined>): string | undefined {
  const values = ids.flatMap((value) => value?.split(/\s+/u) ?? []).filter(Boolean);
  return values.length > 0 ? [...new Set(values)].join(" ") : undefined;
}

/**
 * The semantic field shell for the web adapter.
 *
 * The child stays a native control. This component only supplies its stable
 * id, label relationship, descriptions, and state attributes, so browser
 * validation, keyboard behavior, and form submission remain native.
 */
export function QuietField({
  id,
  label,
  children,
  hint,
  error,
  required = false,
  disabled = false,
  readOnly = false,
  state = error ? "error" : "idle",
  className = "",
}: QuietFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const childProps = children.props as QuietFieldControlProps;
  const describedBy = joinIds(childProps["aria-describedby"], hintId, errorId);
  const controlClassName = ["quiet-field__control", childProps.className].filter(Boolean).join(" ");

  const control = cloneElement(children as ReactElement<QuietFieldControlProps>, {
    id,
    className: controlClassName,
    disabled: disabled || childProps.disabled,
    readOnly: readOnly || childProps.readOnly,
    required: required || childProps.required,
    "aria-describedby": describedBy,
    "aria-errormessage": errorId,
    "aria-invalid": error ? true : childProps["aria-invalid"],
  });

  return (
    <div
      className={`quiet-field ${className}`.trim()}
      data-state={state}
      data-disabled={disabled ? "true" : undefined}
      data-read-only={readOnly ? "true" : undefined}
      aria-busy={state === "loading" ? true : undefined}
    >
      <label className="quiet-field__label" htmlFor={id}>
        <span>{label}</span>
        {required ? <span className="quiet-field__required" aria-hidden="true">*</span> : null}
      </label>
      {control}
      {hint ? <p className="quiet-field__hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="quiet-field__error" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
