import Link from "next/link"
import "./globals.css";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: 'UNLV Parking',
  description: 'CS 472 Senior design project',
};

export default function RootLayout({children, }: {children: React.ReactNode;})  {
  return (
    <html lang="en">
      <body>
        <header>
          <nav className="flex-no-wrap relative flex w-full items-center justify-between bg-zinc-50 py-4 shadow-dark-mild dark:bg-neutral-700 dark:text-white/75 lg:flex-wrap lg:justify-start lg:py-4" style={{ padding: "1rem" }}>
            <Link className = "nav-link" href = "/"> Home </Link> 
            <Link className = "nav-link" href = "/about"> About </Link>
            <Link className = "nav-link" href = "/faq"> FAQ </Link>
            <Link className = "nav-link" href = "/getapp"> Get the App </Link>  
          </nav>
        </header>

        <main style={{ padding: "1rem" }}>
          {children}
        </main>

        <footer style={{ padding: "1rem", bottom: 'auto', backgroundColor: 'grey', textAlign: 'center', textDecorationColor: 'white'}}>
          <p>Footer Placeholder</p>
        </footer>
      </body>
    </html>
  );
}
