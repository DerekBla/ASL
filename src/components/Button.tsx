import type { ButtonHTMLAttributes, ReactElement } from "react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: "primary" | "secondary";
};

const VARIANTS = {
  primary: "bg-accent text-surface hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-muted",
} as const;

/** Action trigger. Defaults to type="button" so it never submits a form by accident. */
export function Button({ variant = "primary", type = "button", ...rest }: Props): ReactElement {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]}`}
      {...rest}
    />
  );
}
