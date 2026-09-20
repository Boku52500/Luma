import type { Metadata } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import { AuthSessionProvider } from "@/components/providers/AuthSessionProvider";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { ScrollToTopOnNavigate } from "@/components/layout/ScrollToTopOnNavigate";
import { auth } from "@/auth";
import { getAppOrigin } from "@/lib/appUrl";
import "./globals.css";

const bodyFont = Noto_Sans_Georgian({
  variable: "--font-body",
  subsets: ["georgian", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getAppOrigin(),
  title: "Luma — ტექნოლოგიების მაღაზია საქართველოში",
  description:
    "Luma — ორიგინალი ტექნიკა და გაჯეტები ოფიციალური გარანტიით. სმარტფონები, ლეპტოპები, ტელევიზორები და აქსესუარები სწრაფი მიწოდებით მთელი საქართველოს მასშტაბით.",
  icons: {
    icon: [{ url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" }],
    apple: [{ url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="ka" data-scroll-behavior="smooth" className={`${bodyFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-text">
        <AuthSessionProvider session={session}>
          <NavigationProgress />
          <ScrollToTopOnNavigate />
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
