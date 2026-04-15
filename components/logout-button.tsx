"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      style={{
        backgroundColor: "#ef4444",
        color: "#fff",
        padding: "8px 12px",
        borderRadius: "6px",
        border: "none",
        cursor: "pointer",
      }}
    >
      Sair
    </button>
  );
}