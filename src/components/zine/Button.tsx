import Link from "next/link";
import type { AnchorHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "danger";

// Design Part 4: 3px ink outline, hard shadow, physically "presses" into its shadow. Danger keeps ink text
// (marker-red text at button size fails contrast); the marker colour goes on the outline instead.
const VARIANTS: Record<Variant, string> = {
  primary: "bg-butter border-ink",
  secondary: "bg-paper border-ink",
  danger: "bg-paper border-marker",
};

export const buttonClass = (variant: Variant) =>
  `label inline-flex min-h-14 items-center justify-center gap-2 rounded-[14px] border-[3px] px-6 text-lg text-ink shadow-hard active:shadow-press motion-safe:transition-[transform,box-shadow] motion-safe:duration-100 motion-safe:hover:-translate-y-px motion-safe:active:translate-x-[3px] motion-safe:active:translate-y-[3px] disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]}`;

export function Button({ variant, className = "", ...props }: { variant: Variant } & ComponentProps<"button">) {
  return <button type="button" {...props} className={`${buttonClass(variant)} ${className}`} />;
}

export function LinkButton({
  variant,
  className = "",
  ...props
}: { variant: Variant } & ComponentProps<typeof Link> & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <Link {...props} className={`${buttonClass(variant)} ${className}`} />;
}
