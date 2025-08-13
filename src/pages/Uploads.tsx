import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import UploadDropzone from "@/components/UploadDropzone";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

// Types (lightweight, not relying on generated types)
type Department = { id: string; name: string };
type Token = { id: string; token: string; label?: string | null };
type TokenDept = { token_id: string; department_id: string };
type Category = { id: string; name: string };
type Process = { id: string; process_number: number; token_id: string; category_id: string | null; note: string | null; created_at: string };
type Upload = { id: string; process_id: string; file_path: string; mime_type: string | null; size: number | null; created_at: string };

const UploadsPage = () => {
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [tokenFilter, setTokenFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Uploads Übersicht | Snap Manage Hub";
    // Meta description
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'Uploads Übersicht mit Filtern nach Abteilung, Upload-Token und Kategorie.');
    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', window.location.href);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["uploads-overview"],
    queryFn: async () => {
      const [depsRes, toksRes, tokDepsRes, catsRes, procsRes, upsRes] = await Promise.all([
        supabase.from("departments").select("id,name").order("name"),
        supabase.from("tokens").select("id,token,label").order("created_at", { ascending: false }),
        supabase.from("token_departments").select("token_id,department_id"),
        supabase.from("categories").select("id,name").order("name"),
        supabase.from("processes").select("id,process_number,token_id,category_id,note,created_at").order("created_at", { ascending: false }),
        supabase.from("uploads").select("id,process_id,file_path,mime_type,size,created_at").order("created_at", { ascending: false }),
      ]);
      if (depsRes.error) throw depsRes.error;
      if (toksRes.error) throw toksRes.error;
      if (tokDepsRes.error) throw tokDepsRes.error;
      if (catsRes.error) throw catsRes.error;
      if (procsRes.error) throw procsRes.error;
      if (upsRes.error) throw upsRes.error;
      return {
        deps: (depsRes.data as Department[]) || [],
        toks: (toksRes.data as Token[]) || [],
        tokDeps: (tokDepsRes.data as TokenDept[]) || [],
        cats: (catsRes.data as Category[]) || [],
        procs: (procsRes.data as Process[]) || [],
        ups: (upsRes.data as Upload[]) || [],
      };
    },
  });

  const tokenById = useMemo(() => {
    const m = new Map<string, Token>();
    data?.toks.forEach((t) => m.set(t.id, t));
    return m;
  }, [data]);

  const catById = useMemo(() => {
    const m = new Map<string, Category>();
    data?.cats.forEach((c) => m.set(c.id, c));
    return m;
  }, [data]);

  const deptIdsByTokenId = useMemo(() => {
    const m = new Map<string, string[]>();
    (data?.tokDeps || []).forEach((td) => {
      const arr = m.get(td.token_id) || [];
      arr.push(td.department_id);
      m.set(td.token_id, arr);
    });
    return m;
  }, [data]);

  const uploadsByProcessId = useMemo(() => {
    const m = new Map<string, Upload[]>();
    (data?.ups || []).forEach((u) => {
      const arr = m.get(u.process_id) || [];
      arr.push(u);
      m.set(u.process_id, arr);
    });
    return m;
  }, [data]);

  const rows = useMemo(() => {
    return (data?.procs || []).map((p) => {
      const t = tokenById.get(p.token_id);
      const dIds = deptIdsByTokenId.get(p.token_id) || [];
      const deptNames = data?.deps.filter((d) => dIds.includes(d.id)).map((d) => d.name).join(", ") || "—";
      const catName = p.category_id ? (catById.get(p.category_id)?.name || "—") : "—";
      const uploads = uploadsByProcessId.get(p.id) || [];
      const lastEdit = uploads.length ? uploads[0].created_at : p.created_at; // uploads sorted desc
      return {
        id: p.id,
        process_number: p.process_number,
        department: deptNames,
        token: t?.label ? `${t.label} (${t.token})` : t?.token || "—",
        category: catName,
        note: p.note || "—",
        created_at: p.created_at,
        last_edit: lastEdit,
      };
    });
  }, [data, tokenById, deptIdsByTokenId, catById, uploadsByProcessId]);

  const filtered = useMemo(() => {
    return (rows || []).filter((r) => {
      const deptOk = deptFilter ? r.department.split(", ")?.some((name) => data?.deps.find((d) => d.id === deptFilter)?.name === name) : true;
      const tokenOk = tokenFilter ? (tokenById.get(tokenFilter)?.token && r.token.includes(tokenById.get(tokenFilter)!.token)) : true;
      const catOk = categoryFilter ? (r.category === (data?.cats.find((c) => c.id === categoryFilter)?.name || "")) : true;
      return deptOk && tokenOk && catOk;
    });
  }, [rows, deptFilter, tokenFilter, categoryFilter, data, tokenById]);

  const selectedProcess = useMemo(() => (data?.procs || []).find((p) => p.id === selectedProcessId) || null, [data, selectedProcessId]);
  const selectedUploads = useMemo(() => (selectedProcess ? (uploadsByProcessId.get(selectedProcess.id) || []) : []), [uploadsByProcessId, selectedProcess]);

  const addFiles = async (files: File[]) => {
    if (!selectedProcess) return;
    setBusy(true);
    try {
      for (const file of files) {
        const path = `${selectedProcess.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { error: rpcErr } = await supabase.rpc("add_upload", {
          process: selectedProcess.id,
          file_path: path,
          mime: file.type,
          size: file.size,
        });
        if (rpcErr) throw rpcErr;
      }
      toast({ title: "Uploads hinzugefügt" });
      await refetch();
    } catch (e: any) {
      toast({ title: "Fehler beim Hochladen", description: e.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  const deleteUpload = async (u: Upload) => {
    setBusy(true);
    try {
      await supabase.storage.from("uploads").remove([u.file_path]);
      const { error } = await supabase.from("uploads").delete().eq("id", u.id);
      if (error) throw error;
      toast({ title: "Upload gelöscht" });
      await refetch();
    } catch (e: any) {
      toast({ title: "Löschen fehlgeschlagen", description: e.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  const publicUrl = (path: string) => supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl;

  return (
    <main className="min-h-screen bg-background">
      <section className="container py-8 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Uploads Übersicht</h1>
          <a href="/admin" className="underline text-sm">Admin</a>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm mb-2">Abteilung</label>
            <Select value={deptFilter ?? "all"} onValueChange={(v) => setDeptFilter(v === "all" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Alle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {(data?.deps || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm mb-2">Upload-Token</label>
            <Select value={tokenFilter ?? "all"} onValueChange={(v) => setTokenFilter(v === "all" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Alle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {(data?.toks || []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label ? `${t.label} (${t.token})` : t.token}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm mb-2">Kategorie</label>
            <Select value={categoryFilter ?? "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Alle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {(data?.cats || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Abteilung</TableHead>
                <TableHead>Upload-Token</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Notiz</TableHead>
                <TableHead>Erstellt am</TableHead>
                <TableHead>Letzte Änderung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6}>Laden…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">Keine Einträge</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedProcessId(r.id)}>
                    <TableCell>{r.department}</TableCell>
                    <TableCell className="font-mono text-xs">{r.token}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell className="truncate max-w-[320px]">{r.note}</TableCell>
                    <TableCell>{format(new Date(r.created_at), "dd.MM.yyyy HH:mm")}</TableCell>
                    <TableCell>{format(new Date(r.last_edit), "dd.MM.yyyy HH:mm")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={!!selectedProcessId} onOpenChange={(open) => !open && setSelectedProcessId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vorgang-Uploads</DialogTitle>
          </DialogHeader>

          {selectedProcess && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <div><span className="font-medium">Kategorie:</span> {selectedProcess.category_id ? (catById.get(selectedProcess.category_id)?.name || "—") : "—"}</div>
                <div><span className="font-medium">Notiz:</span> {selectedProcess.note || "—"}</div>
              </div>

              <UploadDropzone onFilesSelected={addFiles} disabled={busy} />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {selectedUploads.length === 0 ? (
                  <div className="col-span-full text-sm text-muted-foreground">Noch keine Uploads vorhanden.</div>
                ) : (
                  selectedUploads.map((u) => (
                    <div key={u.id} className="relative rounded-md border overflow-hidden">
                      <img src={publicUrl(u.file_path)} alt={`Upload ${u.id}`} loading="lazy" className="w-full h-40 object-cover" />
                      <Button size="icon" variant="outline" className="absolute top-2 right-2" onClick={() => deleteUpload(u)} disabled={busy}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default UploadsPage;
