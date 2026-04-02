import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Probatio",
    default: "Sign In | Probatio",
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
