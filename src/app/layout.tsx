import type { ReactNode } from "react";

export const metadata = {
  title: "Pintakasi: Bloodlines",
  description: "Breed, fight, retire. No UI — play via Claude (MCP) or REST.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
