"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

type Role = "locatario" | "marketing" | "admin" | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  originalRole: Role;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  switchRole: (newRole: Role) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  originalRole: null,
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
  switchRole: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const originalRoleRef = useRef<Role>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const r = snap.data().role as Role;
          setRole(r);
          originalRoleRef.current = r;
        } else {
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
          originalRoleRef.current = assignedRole;
        }
      } else {
        setRole(null);
        originalRoleRef.current = null;
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
    <AuthContext.Provider value={{ user, role, originalRole: originalRoleRef.current, loading, signIn, logOut, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
