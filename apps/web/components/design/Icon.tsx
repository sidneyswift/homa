import type { LucideProps } from "lucide-react";
import { iconContract, isSemanticIconName, type SemanticIconName } from "@homa/design/contract";
import { semanticIconRegistry } from "./icon-registry";

type IconSize = (typeof iconContract.sizes)[number];

type DecorativeIconProps = {
  decorative?: true;
  label?: never;
};

type LabeledIconProps = {
  decorative: false;
  label: string;
};

export type IconProps = Omit<LucideProps, "aria-hidden" | "aria-label" | "size" | "strokeWidth"> & {
  name: SemanticIconName;
  size?: IconSize;
} & (DecorativeIconProps | LabeledIconProps);

/**
 * Render a semantic icon with the Quiet authority defaults. Decorative icons
 * are hidden from assistive technology; meaningful standalone icons must pass
 * `decorative={false}` and a visible label.
 */
export function Icon({
  name,
  size = 20,
  decorative = true,
  label,
  ...props
}: IconProps) {
  if (!isSemanticIconName(name)) throw new Error(`Unknown web semantic icon role: ${name}`);
  const Glyph = semanticIconRegistry[name];
  if (!Glyph) throw new Error(`Missing web glyph for semantic icon role: ${name}`);
  return (
    <Glyph
      {...props}
      size={size}
      strokeWidth={iconContract.strokePx}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
    />
  );
}

export type { SemanticIconName };
