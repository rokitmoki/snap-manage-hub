import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = mode === "login" ? "Login | Admin" : "Sign Up | Admin";
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        window.location.href = "/admin";
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/admin";
    });
    return () => subscription.unsubscribe();
  }, [mode]);

  const canSubmit = useMemo(() => email.length > 3 && password.length >= 6 && !busy, [email, password, busy]);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const redirectUrl = `${window.location.origin}/admin`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl }
        });
        if (error) throw error;
        toast({ title: "Überprüfen Sie Ihr Postfach", description: "Bestätigen Sie Ihre E-Mail, um fortzufahren." });
      }
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Admin Login" : "Admin Signup"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>E-Mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Passwort</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button variant="hero" onClick={submit} disabled={!canSubmit} className="w-full">
            {mode === "login" ? "Einloggen" : "Registrieren"}
          </Button>
          <div className="text-sm text-muted-foreground text-center">
            {mode === "login" ? (
              <>Noch kein Konto? <button className="underline" onClick={() => setMode("signup")}>Registrieren</button></>
            ) : (
              <>Schon registriert? <button className="underline" onClick={() => setMode("login")}>Einloggen</button></>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
