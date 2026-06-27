/** Button with safe defaults — always explicit type to avoid accidental form submit. */
export function AppButton({
  type = "button",
  variant = "",
  className = "",
  loading = false,
  disabled = false,
  children,
  ...rest
}) {
  const classes = ["btn", variant, className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? "Loading…" : children}
    </button>
  );
}
