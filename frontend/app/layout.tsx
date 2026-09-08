import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Meridian", description: "Meridian financial advisory prototype" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
