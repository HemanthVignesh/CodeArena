"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SafeUser, SafeProfile } from "@/lib/auth";
import { User, LogOut, LayoutDashboard, Shield, Award } from "lucide-react";

interface UserNavProps {
  user: SafeUser;
  profile: SafeProfile | null;
}

export function UserNav({ user, profile }: UserNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.refresh();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // User initial or placeholder
  const initial = user.username.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800/80 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-black font-bold text-sm shadow-sm">
          {initial}
        </div>
        <div className="hidden sm:flex flex-col text-left">
          <span className="text-sm font-semibold text-slate-200 leading-tight">
            {user.username}
          </span>
          <span className="text-[11px] text-emerald-400 font-mono">
            {profile ? `${profile.rating} Rating` : user.role}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-2.5 border-b border-slate-800/80">
            <p className="text-xs text-slate-400">Signed in as</p>
            <p className="text-sm font-semibold text-white truncate">
              {user.email}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                <Award className="w-3 h-3" />
                {profile?.totalSolved ?? 0} Solved
              </span>
              {user.role === "ADMIN" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950 text-amber-400 border border-amber-800/50">
                  <Shield className="w-3 h-3" />
                  ADMIN
                </span>
              )}
            </div>
          </div>

          <div className="py-1">
            <Link
              href={`/profile/${user.username}`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <User className="w-4 h-4 text-emerald-400" />
              <span>My Profile</span>
            </Link>
            <Link
              href="/submissions"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <Award className="w-4 h-4 text-purple-400" />
              <span>My Submissions</span>
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-slate-400" />
              <span>Dashboard</span>
            </Link>
          </div>

          <div className="border-t border-slate-800/80 pt-1 mt-1">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50 text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
