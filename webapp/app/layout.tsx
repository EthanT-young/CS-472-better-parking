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
      <body className="page-layout">
        <header>
          <h1 className="site-title"> UNLV Parking </h1>

          <nav className="nav-bar" aria-label="Main navigation">
            <Link className = "nav-link" href = "/"> Home </Link> 
            <Link className = "nav-link" href = "/about"> About </Link>
            <Link className = "nav-link" href = "/faq"> FAQ </Link>
            <Link className = "nav-link" href = "/getapp"> Get the App </Link>  
          </nav>
        </header>

        <main className="page-content">
          {children}
        </main>

        <footer className="site-footer">
          <p>Footer Placeholder</p>
        </footer>
      </body>
    </html>
  );
}
