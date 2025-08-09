import React, { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

export type UploadDropzoneProps = {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
};

const UploadDropzone: React.FC<UploadDropzoneProps> = ({ onFilesSelected, disabled }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      if (files.length) onFilesSelected(files);
    },
    [onFilesSelected, disabled]
  );

  const onPick = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length) onFilesSelected(images);
    // reset so same files can be picked again
    if (inputRef.current) inputRef.current.value = "";
  }, [onFilesSelected]);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={onPick}
      className="w-full rounded-lg border border-dashed border-input bg-background hover:bg-accent/50 transition-colors cursor-pointer p-6 text-center"
      aria-disabled={disabled}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="text-sm text-muted-foreground">Bilder hierher ziehen oder klicken, um auszuwählen</div>
        <div className="text-xs text-muted-foreground">Erlaubte Formate: Bilder. Nutzen Sie die Kamerafunktion Ihres Geräts.</div>
        <Button variant="soft" size="sm" type="button">Dateien auswählen</Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onChange}
        capture
      />
    </div>
  );
};

export default UploadDropzone;
