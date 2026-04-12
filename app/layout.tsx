import type { Metadata } from "next";
import "../src/index.css";
import { Providers } from "./providers";
import AppShell from "@/components/app/AppShell";

export const metadata: Metadata = {
  title: "Echoverse",
  description: "Interactive AI audio narrative engine",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
