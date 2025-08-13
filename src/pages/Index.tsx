import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import UploadDropzone from "@/components/UploadDropzone";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [token, setToken] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [emailNotification, setEmailNotification] = useState(false);

  useEffect(() => {
    document.title = "Allgemeine Uploads | Snap Manage Hub";
    const link = document.querySelector("link[rel=canonical]") || document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", window.location.href);
    if (!link.isConnected) document.head.appendChild(link);
  }, []);

  useEffect(() => {
    supabase
      .from("categories")
      .select("id,name")
      .order("name")
      .then(({ data }) => setCategories(data || []));
  }, []);

  const canStart = useMemo(() => token.trim().length > 0 && !!categoryId && files.length > 0 && !busy, [token, categoryId, files, busy]);

  const onStartUpload = async () => {
    if (!canStart) return;
    setBusy(true);
    try {
      const { data: process, error } = await supabase.rpc("start_process", {
        token_value: token.trim(),
        category: categoryId,
        note,
      }).maybeSingle();
      const p: any = process as any;
      if (error || !p) throw error || new Error("Kein Prozess erstellt");

      // Upload files sequentially to keep it simple and reliable
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const safeName = f.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
        const filePath = `${p.process_number}/${Date.now()}_${i}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("uploads").upload(filePath, f, {
          contentType: f.type || "image/*",
          upsert: false,
        });
        if (upErr) throw upErr;
        const { error: metaErr } = await supabase.rpc("add_upload", {
          process: p.id,
          file_path: filePath,
          mime: f.type || "image/*",
          size: f.size,
        }).maybeSingle();
        if (metaErr) throw metaErr;
      }

      // Send email notification if enabled
      if (emailNotification) {
        try {
          // Get token details to fetch email
          const { data: tokenData } = await supabase
            .from("tokens")
            .select("email")
            .eq("token", token.trim())
            .single();

          if (tokenData?.email) {
            // Get category name
            const { data: categoryData } = await supabase
              .from("categories")
              .select("name")
              .eq("id", categoryId)
              .single();

            await supabase.functions.invoke("send-notification", {
              body: {
                email: tokenData.email,
                processNumber: p.process_number,
                category: categoryData?.name || "Unbekannt",
                fileCount: files.length,
                note: note || undefined,
              },
            });
            
            console.log("Email notification sent successfully");
          } else {
            console.warn("No email associated with token, skipping notification");
          }
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
          // Don't fail the upload if email fails
        }
      }

      toast({ title: "Upload erfolgreich", description: `Vorgang #${p.process_number} wurde erstellt.` });
      // reset
      setFiles([]);
      setNote("");
      setEmailNotification(false);
      // keep token and category for next run
    } catch (e: any) {
      toast({ title: "Fehler beim Upload", description: e.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="container py-10">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold">Allgemeine Uploads</h1>
          <a href="/admin" className="text-sm underline text-foreground">Admin</a>
        </header>

        <Card className="overflow-hidden">
          <CardHeader className="bg-primary/10">
            <CardTitle>Neuer Allgemeiner Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-3 space-y-2">
                <Label htmlFor="token">Upload-Token</Label>
                <Input id="token" placeholder="z. B. tok_abc123" value={token} onChange={(e) => setToken(e.target.value)} />
              </div>

              <div className="md:col-span-3">
                <UploadDropzone onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])} disabled={busy} />
              </div>

              <div className="space-y-2">
                <Label>Kategorie</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Bitte auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notiz (optional)</Label>
                <Textarea placeholder="Gilt für alle neu hochgeladenen Bilder dieses Vorgangs" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="email-notification"
                    checked={emailNotification}
                    onCheckedChange={setEmailNotification}
                  />
                  <Label htmlFor="email-notification">E-Mail Benachrichtigung nach Upload</Label>
                </div>
              </div>
            </div>

            {files.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {files.map((f, idx) => (
                  <figure key={idx} className="rounded-md border p-2">
                    <img src={URL.createObjectURL(f)} alt={`Ausgewähltes Bild ${idx + 1}`} className="aspect-square w-full object-cover rounded" loading="lazy" />
                    <figcaption className="mt-2 text-xs text-muted-foreground truncate">{f.name}</figcaption>
                  </figure>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 pt-2">
              <Button variant="hero" onClick={onStartUpload} disabled={!canStart}>
                Upload-Vorgang starten & Bilder hochladen
              </Button>
              <div className="text-sm text-muted-foreground">Status: {busy ? "Lade hoch…" : "Bereit"}</div>
            </div>
          </CardContent>
        </Card>

        <section className="mt-10">
          <h2 className="text-xl font-medium mb-2">Bisherige Allgemeine Uploads</h2>
          <p className="text-sm text-muted-foreground">Noch keine Vorgänge vorhanden.</p>
        </section>
      </section>
    </main>
  );
};

export default Index;
