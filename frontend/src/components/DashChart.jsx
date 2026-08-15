import { ResponsiveContainer } from "recharts";

/** Avoid Recharts width(-1)/height(-1) when the dashboard grid has not laid out yet. */
export function DashChart({ children, height = 168 }) {
  return (
    <ResponsiveContainer width="100%" height={height} minWidth={0} minHeight={0} debounce={80}>
      {children}
    </ResponsiveContainer>
  );
}
