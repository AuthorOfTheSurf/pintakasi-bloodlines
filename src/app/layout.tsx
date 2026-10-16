import type { ReactNode } from "react";

export const metadata = {
  title: "Pintakasi: Bloodlines",
  description:
    "Raise fighting cocks, read them from how they fight, and breed a line good enough to win a Major. Played through Claude.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
