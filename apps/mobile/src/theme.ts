import { StyleSheet } from "react-native";

export const colors = {
  bg: "#f5f6f8",
  card: "#ffffff",
  text: "#14171f",
  muted: "#6b7280",
  border: "#e5e7eb",
  primary: "#2563eb",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
};

export const spacing = (n: number) => n * 4;

export const shared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(4), gap: spacing(3) },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing(4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  h1: { fontSize: 22, fontWeight: "700", color: colors.text },
  h2: { fontSize: 17, fontWeight: "600", color: colors.text },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 15,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
});
