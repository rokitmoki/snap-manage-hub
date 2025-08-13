import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2, Plus } from "lucide-react";

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
  const [tokenEmail, setTokenEmail] = useState("");
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

  const updateDepartment = async (id: string, name: string) => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").update({ name: name.trim() }).eq("id", id);
      if (error) throw error;
      await refreshAll();
      toast({ title: "Erfolg", description: "Abteilung aktualisiert" });
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message ?? String(e) });
    } finally { setBusy(false); }
  };

  const deleteDepartment = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
      await refreshAll();
      toast({ title: "Erfolg", description: "Abteilung gelöscht" });
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message ?? String(e) });
    } finally { setBusy(false); }
  };

  const createToken = async () => {
    setBusy(true);
    try {
      const token = genToken();
      const { data: tok, error } = await supabase.from("tokens").insert({ 
        token, 
        label: label || null,
        email: tokenEmail || null 
      }).select("id").maybeSingle();
      if (error) throw error;
      if (tok && selectedDeptIds.length) {
        const rows = selectedDeptIds.map((d) => ({ token_id: tok.id, department_id: d }));
        const { error: pe } = await supabase.from("token_departments").insert(rows);
        if (pe) throw pe;
      }
      setLabel("");
      setTokenEmail("");
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
                <Label>E-Mail für Benachrichtigungen (optional)</Label>
                <Input placeholder="z. B. fahrer@firma.de" value={tokenEmail} onChange={(e) => setTokenEmail(e.target.value)} />
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
                    <div key={d.id} className="flex items-center justify-between">
                      <span className="text-sm">{d.name}</span>
                      <div className="flex items-center gap-1">
                        <EditDepartmentDialog 
                          department={d} 
                          onUpdate={updateDepartment} 
                          disabled={busy} 
                        />
                        <DeleteDepartmentDialog 
                          department={d} 
                          onDelete={deleteDepartment} 
                          disabled={busy} 
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Kategorien</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CategoryManager />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prozess-Historie</CardTitle>
            </CardHeader>
            <CardContent>
              <ProcessHistory />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
};

const CategoryManager = () => {
  const [name, setName] = useState("");
  const [cats, setCats] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("categories").select("id,name").order("name");
    setCats(data || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("categories").insert({ name: name.trim() });
      if (error) throw error;
      setName("");
      await load();
      toast({ title: "Erfolg", description: "Kategorie erstellt" });
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message ?? String(e) });
    } finally { setBusy(false); }
  };

  const update = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("categories").update({ name: newName.trim() }).eq("id", id);
      if (error) throw error;
      await load();
      toast({ title: "Erfolg", description: "Kategorie aktualisiert" });
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message ?? String(e) });
    } finally { setBusy(false); }
  };

  const deleteCategory = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      await load();
      toast({ title: "Erfolg", description: "Kategorie gelöscht" });
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message ?? String(e) });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label>Neue Kategorie</Label>
          <Input placeholder="z. B. Allgemein" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button variant="hero" onClick={create} disabled={!name.trim() || busy}>Anlegen</Button>
      </div>
      <div className="rounded-md border p-3 space-y-2">
        {cats.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine Kategorien vorhanden.</div>
        ) : (
          cats.map((c) => (
            <div key={c.id} className="flex items-center justify-between">
              <span className="text-sm">{c.name}</span>
              <div className="flex items-center gap-1">
                <EditCategoryDialog 
                  category={c} 
                  onUpdate={update} 
                  disabled={busy} 
                />
                <DeleteCategoryDialog 
                  category={c} 
                  onDelete={deleteCategory} 
                  disabled={busy} 
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const EditDepartmentDialog = ({ department, onUpdate, disabled }: { department: Department; onUpdate: (id: string, name: string) => void; disabled: boolean }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(department.name);

  const handleSubmit = () => {
    onUpdate(department.id, name);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abteilung bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>Speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DeleteDepartmentDialog = ({ department, onDelete, disabled }: { department: Department; onDelete: (id: string) => void; disabled: boolean }) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Abteilung löschen</AlertDialogTitle>
          <AlertDialogDescription>
            Sind Sie sicher, dass Sie die Abteilung "{department.name}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDelete(department.id)}>Löschen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const EditCategoryDialog = ({ category, onUpdate, disabled }: { category: any; onUpdate: (id: string, name: string) => void; disabled: boolean }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);

  const handleSubmit = () => {
    onUpdate(category.id, name);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kategorie bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>Speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DeleteCategoryDialog = ({ category, onDelete, disabled }: { category: any; onDelete: (id: string) => void; disabled: boolean }) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kategorie löschen</AlertDialogTitle>
          <AlertDialogDescription>
            Sind Sie sicher, dass Sie die Kategorie "{category.name}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDelete(category.id)}>Löschen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const ProcessHistory = () => {
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProcesses = async () => {
      try {
        const { data } = await supabase
          .from("processes")
          .select(`
            *,
            categories(name),
            tokens(label, token)
          `)
          .order("created_at", { ascending: false })
          .limit(10);
        setProcesses(data || []);
      } catch (error) {
        console.error("Error loading processes:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProcesses();
  }, []);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Lade Prozesse...</div>;
  }

  return (
    <div className="space-y-3">
      {processes.length === 0 ? (
        <div className="text-sm text-muted-foreground">Keine Prozesse vorhanden.</div>
      ) : (
        processes.map((process) => (
          <div key={process.id} className="rounded-md border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">Prozess #{process.process_number}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(process.created_at).toLocaleDateString("de-DE", { 
                  day: "2-digit", 
                  month: "2-digit", 
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
            </div>
            <div className="text-sm space-y-1">
              {process.categories && (
                <div>Kategorie: {process.categories.name}</div>
              )}
              {process.tokens && (
                <div>Token: {process.tokens.label || process.tokens.token}</div>
              )}
              {process.note && (
                <div className="text-muted-foreground">Notiz: {process.note}</div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default Admin;
