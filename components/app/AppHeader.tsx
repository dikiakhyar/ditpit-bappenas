"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTheme } from "@/lib/theme";
import { Icon } from "@/components/ui/icons";
import { cariWilayah, isProvCode, namaWilayah, type WilayahRow } from "@/lib/wilayah";

const NAV = [
  { href: "/", label: "Peta Tematik", icon: "map" },
  { href: "/profil", label: "Profil Daerah", icon: "report" },
];

/** Header bersama semua halaman — pola navbar Tabler: merek di kiri,
 *  tautan halaman dengan garis aktif di bawah, pencarian wilayah, tema. */
export default function AppHeader({ leading }: { leading?: ReactNode }) {
  const path = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="z-30 shrink-0 border-b border-border bg-surface">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        {leading}
        <Link href="/" className="flex shrink-0 items-center gap-2.5 pr-1">
          <Image src="/logo.png" alt="Logo Bappenas" width={30} height={30} priority className="h-7 w-7 object-contain" />
          <span className="hidden leading-tight sm:block">
            <span className="block text-[13.5px] font-semibold tracking-tight">DITPIT Bappenas</span>
            <span className="block text-[11px] text-muted">Dashboard Wilayah Timur</span>
          </span>
        </Link>

        <nav className="ml-1 hidden h-14 items-stretch md:flex" aria-label="Halaman">
          {NAV.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`relative flex items-center gap-2 px-3 text-[13.5px] font-medium transition-colors ${
                  on ? "text-primary" : "text-ink-2 hover:text-foreground"
                }`}
              >
                <Icon name={n.icon} className="h-[18px] w-[18px]" />
                {n.label}
                {on && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-t bg-primary" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <RegionSearch />
          <button onClick={toggleTheme} aria-label={theme === "dark" ? "Mode terang" : "Mode gelap"} className="btn !px-2">
            <Icon name={theme === "dark" ? "sun" : "moon"} className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* navigasi halaman untuk layar kecil */}
      <nav className="flex border-t border-border md:hidden" aria-label="Halaman">
        {NAV.map((n) => {
          const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-2 text-[13px] font-medium ${
                on ? "text-primary" : "text-ink-2"
              }`}
            >
              <Icon name={n.icon} className="h-4 w-4" />
              {n.label}
              {on && <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-t bg-primary" />}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function RegionSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const hits = cariWilayah(q);

  // Ctrl/⌘ + K → fokus pencarian
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  const go = (w: WilayahRow) => {
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
    router.push(`/profil?kode=${w[0]}`);
  };

  return (
    <div ref={boxRef} className="relative min-w-0">
      <div className="flex w-[150px] items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 focus-within:border-primary focus-within:bg-surface sm:w-[240px] lg:w-[300px]">
        <Icon name="search" className="h-4 w-4 shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(h + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && hits[hi]) {
              go(hits[hi]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Cari provinsi atau kabupaten/kota"
          placeholder="Cari provinsi / kab/kota…"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted focus-visible:outline-none"
        />
        <kbd className="hidden shrink-0 rounded border border-border bg-surface px-1.5 font-mono text-[10px] text-muted lg:block">
          Ctrl K
        </kbd>
      </div>

      {open && q.trim() && (
        <ul
          id={listId}
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {hits.length === 0 && <li className="px-3 py-2 text-[13px] text-muted">Wilayah tidak ditemukan.</li>}
          {hits.map((w, i) => (
            <li key={w[0]} role="option" aria-selected={i === hi}>
              <button
                onMouseEnter={() => setHi(i)}
                onClick={() => go(w)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === hi ? "bg-primary-lt" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{w[1]}</span>
                  <span className="block truncate text-[11.5px] text-muted">
                    {isProvCode(w[0]) ? "Provinsi" : namaWilayah(w[2])}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-muted">{w[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
