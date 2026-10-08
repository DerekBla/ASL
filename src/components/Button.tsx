import type { ButtonHTMLAttributes, ReactElement } from "react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: "primary" | "secondary";
};

const VARIANTS = {
  primary: "bg-accent text-on-accent shadow-soft hover:brightness-110",
  secondary: "bg-surface-muted text-ink hover:bg-line/70",
} as const;

/** Action trigger. Defaults to type="button" so it never submits a form by accident. */
export function Button({ variant = "primary", type = "button", ...rest }: Props): ReactElement {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-full px-5 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]}`}
      {...rest}
    />
  );
}
