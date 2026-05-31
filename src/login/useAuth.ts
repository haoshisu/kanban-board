import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";
import { isLocalDataMode } from "../lib/localDataMode";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { clearAuthUser, loadAuthUser, saveAuthUser } from "./authStorage";
import type { AuthUser, LoginInput, LoginResult } from "./types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getNameFromEmail = (email: string) => {
 const [name] = email.split("@");

 return name || email;
};

const mapAuthUser = (user: User): AuthUser => {
 const email = user.email ?? "";

 return {
  id: user.id,
  email,
  name:
   typeof user.user_metadata.name === "string" ? user.user_metadata.name : getNameFromEmail(email),
  loggedInAt: user.last_sign_in_at ?? new Date().toISOString(),
 };
};

const ensureProfile = async (
 supabase: SupabaseClient<Database>,
 user: AuthUser,
) => {
 const { error } = await supabase.from("profiles").upsert(
  {
   id: user.id,
   display_name: user.name,
  },
  { onConflict: "id" },
 );
 if (error) {
  console.error(error);
 }
};

export const useAuth = () => {
 const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
  if (isLocalDataMode()) {
   let isMounted = true;

   const loadLocalUser = async () => {
    await Promise.resolve();

    if (!isMounted) {
     return;
    }

    setCurrentUser(loadAuthUser());
    setIsLoading(false);
   };

   void loadLocalUser();

   return () => {
    isMounted = false;
   };
  }

  let isMounted = true;

  const loadSupabaseSession = async () => {
   const supabase = await getSupabase();
   const { data } = await supabase.auth.getSession();

   if (!isMounted) {
    return;
   }

   if (data.session?.user) {
    const user = mapAuthUser(data.session.user);
    setCurrentUser(user);
    void ensureProfile(supabase, user);
   } else {
    setCurrentUser(null);
   }
   setIsLoading(false);
  };

  void loadSupabaseSession();

  let unsubscribe: (() => void) | undefined;

  void getSupabase().then((supabase) => {
   if (!isMounted) {
    return;
   }

   const {
    data: { subscription },
   } = supabase.auth.onAuthStateChange((_event, session) => {
   if (session?.user) {
    const user = mapAuthUser(session.user);
    setCurrentUser(user);
    void ensureProfile(supabase, user);
   } else {
    setCurrentUser(null);
   }
   setIsLoading(false);
  });

   unsubscribe = () => subscription.unsubscribe();
  });

  return () => {
   isMounted = false;
   unsubscribe?.();
  };
 }, []);

 const login = async (input: LoginInput): Promise<LoginResult> => {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();

  if (!emailPattern.test(email)) {
   return { success: false, message: "請輸入有效的 email" };
  }

  if (!password) {
   return { success: false, message: "請輸入密碼" };
  }

  if (isLocalDataMode()) {
   const user = {
    id: `local-${email}`,
    email,
    name: getNameFromEmail(email),
    loggedInAt: new Date().toISOString(),
   };

   saveAuthUser(user);
   setCurrentUser(user);

   return { success: true, message: "" };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
   email,
   password,
  });

  if (error) {
   return {
    success: false,
    message: error.message || "登入失敗，請確認帳號或密碼",
   };
  }

  if (data.user) {
   const user = mapAuthUser(data.user);
   await ensureProfile(supabase, user);
   setCurrentUser(user);
  }

  return { success: true, message: "" };
 };

 const logout = async () => {
  if (isLocalDataMode()) {
   clearAuthUser();
   setCurrentUser(null);
   return;
  }

  const supabase = await getSupabase();
  await supabase.auth.signOut();
  setCurrentUser(null);
 };

 return {
  currentUser,
  isLoading,
  login,
  logout,
 };
};
