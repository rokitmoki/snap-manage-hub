import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

type Department = { id: string; name: string };

function genToken() {
  const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `tok_${rand}`;
}

const Admin = () => {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [label, setLabel] = useState("");
  const [deptName, setDeptName] = useState("");
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Admin | Snap Manage Hub";

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) window.location.href = "/auth";
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) window.location.href = "/auth";
      else setSessionChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionChecked) return;
    refreshAll();
  }, [sessionChecked]);

  const refreshAll = async () => {
    const [{ data: deps }, { data: toks }] = await Promise.all([
      supabase.from("departments").select("id,name").order("name"),
      supabase.from("tokens").select("id,token,label,active,created_at").order("created_at", { ascending: false }),
    ]);
    setDepartments(deps || []);
    setTokens(toks || []);
  };

  const createDepartment = async () => {
    if (!deptName.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").insert({ name: deptName.trim() });
      if (error) throw error;
      setDeptName("");
      await refreshAll();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message ?? String(e) });
    } finally { setBusy(false); }
  };

  const createToken = async () => {
    setBusy(true);
    try {
      const token = genToken();
      const { data: tok, error } = await supabase.from("tokens").insert({ token, label: label || null }).select("id").maybeSingle();
      if (error) throw error;
      if (tok && selectedDeptIds.length) {
        const rows = selectedDeptIds.map((d) => ({ token_id: tok.id, department_id: d }));
        const { error: pe } = await supabase.from("token_departments").insert(rows);
        if (pe) throw pe;
      }
      setLabel("");
      setSelectedDeptIds([]);
      toast({ title: "Token erstellt", description: token });
      await refreshAll();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message ?? String(e) });
    } finally { setBusy(false); }
  };

  const toggleTokenActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("tokens").update({ active }).eq("id", id);
    if (error) toast({ title: "Fehler", description: error.message });
    else await refreshAll();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const onDeptToggle = (deptId: string) => {
    setSelectedDeptIds((prev) => prev.includes(deptId) ? prev.filter((i) => i !== deptId) : [...prev, deptId]);
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="container py-8 space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="underline text-sm">Zurück</a>
            <a href="/uploads" className="underline text-sm">Uploads</a>
            <h1 className="text-3xl font-semibold">Admin</h1>
          </div>
          <Button variant="outline" onClick={signOut}>Abmelden</Button>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Token-Verwaltung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Bezeichnung (optional)</Label>
                <Input placeholder="z. B. Fahrer A" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Abteilungen (optional)</Label>
                <div className="rounded-md border p-3 space-y-2">
                  {departments.length === 0 && (
                    <div className="text-sm text-muted-foreground">Keine Abteilungen vorhanden.</div>
                  )}
                  {departments.map((d) => (
                    <label key={d.id} className="flex items-center gap-2">
                      <Checkbox checked={selectedDeptIds.includes(d.id)} onCheckedChange={() => onDeptToggle(d.id)} />
                      <span>{d.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="hero" onClick={createToken} disabled={busy}>Neues Token erstellen</Button>
              </div>
              <div className="rounded-md border p-3 space-y-3">
                {tokens.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Keine Tokens vorhanden.</div>
                ) : (
                  tokens.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.label || "Ohne Bezeichnung"}</div>
                        <div className="text-xs text-muted-foreground truncate">{t.token}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(t.token)}>Kopieren</Button>
                        <Button variant={t.active ? "secondary" : "outline"} size="sm" onClick={() => toggleTokenActive(t.id, !t.active)}>
                          {t.active ? "Deaktivieren" : "Aktivieren"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Abteilungen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label>Neue Abteilung</Label>
                  <Input placeholder="z. B. Vertrieb" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
                </div>
                <Button variant="hero" onClick={createDepartment} disabled={busy || !deptName.trim()}>Anlegen</Button>
              </div>
              <div className="rounded-md border p-3 space-y-2">
                {departments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Keine Abteilungen vorhanden.</div>
                ) : (
                  departments.map((d) => (
                    <div key={d.id} className="text-sm">{d.name}</div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kategorien</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryManager />
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

const CategoryManager = () => {
  const [name, setName] = useState("");
  const [cats, setCats] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("categories").select("id,name").order("name");
    setCats(data || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: name.trim() });
    if (error) return toast({ title: "Fehler", description: error.message });
    setName("");
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label>Neue Kategorie</Label>
          <Input placeholder="z. B. Allgemein" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button variant="hero" onClick={create} disabled={!name.trim()}>Anlegen</Button>
      </div>
      <div className="rounded-md border p-3 space-y-2">
        {cats.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine Kategorien vorhanden.</div>
        ) : (
          cats.map((c) => <div key={c.id} className="text-sm">{c.name}</div>)
        )}
      </div>
    </div>
  );
};

export default Admin;
