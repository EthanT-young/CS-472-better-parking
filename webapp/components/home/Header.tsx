"use client";

import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6">
        <Link href="/" className="text-xl font-extrabold tracking-tight sm:text-2xl">
          UNLV <span className="text-red-500">Parking</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 xl:flex">
          <Link href="/" className="text-white transition hover:text-red-400">
            Home
          </Link>

          <Link href="/sites" className="transition hover:white">
            Sites
          </Link>

          <Link href="/about" className="transition hover:white">
            About
          </Link>

          <Link href="/faq" className="transition hover:white">
            FAQ
          </Link>
        </nav>

        <div className="hidden md:block">
          <Link
            href="/sites"
            className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            Find Parking
          </Link>
        </div>
        
        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 md:hidden"
        >
          <span className="text-xl">
            {menuOpen ? "×" : "☰"}
          </span>
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-800 bg-slate-950 px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-4 text-sm font-medium">
            <Link href="/" onClick={() => setMenuOpen(false)}>
              Home
            </Link>

            <Link href="/sites" onClick={() => setMenuOpen(false)}>
              Sites
            </Link>

            <Link href="/about" onClick={() => setMenuOpen(false)}>
              About
            </Link>

            <Link href="/faq" onClick={() => setMenuOpen(false)}>
              FAQ
            </Link>

            <Link
              href="/sites"
              onClick={() => setMenuOpen(false)}
              className="mt-2 rounded-lg bg-red-500 px-4 py-3 text-center font-semibold"
            >
              Find Parking
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
