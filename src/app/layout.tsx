import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sawyer Lundberg",
  description: "Personal website of Sawyer Lundberg",
  metadataBase: new URL("https://sawyerlundberg.com"),
  openGraph: {
    title: "Sawyer Lundberg",
    description: "Personal website of Sawyer Lundberg",
    url: "https://sawyerlundberg.com",
    siteName: "Sawyer Lundberg",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sawyer Lundberg",
    description: "Personal website of Sawyer Lundberg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} style={{ colorScheme: "light" }}>
      <body className="h-full">{children}</body>
    </html>
  );
}
