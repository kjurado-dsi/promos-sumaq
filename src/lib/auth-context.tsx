"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

type Role = "locatario" | "marketing" | "admin" | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  switchRole: (newRole: Role) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
  switchRole: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          setRole(snap.data().role as Role);
        } else {
          // Nuevo usuario: verificar si tiene rol pre-asignado por admin
          const allowedSnap = await getDoc(doc(db, "allowed_roles", u.email!));
          const assignedRole: Role = allowedSnap.exists()
            ? (allowedSnap.data().role as Role)
            : "locatario";
          await setDoc(doc(db, "users", u.uid), {
            email: u.email,
            name: u.displayName,
            photo: u.photoURL,
            role: assignedRole,
            createdAt: new Date(),
          });
          setRole(assignedRole);
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signIn = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const switchRole = async (newRole: Role) => {
    if (!newRole) return;
    setRole(newRole);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, logOut, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
