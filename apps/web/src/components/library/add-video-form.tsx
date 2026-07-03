"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIngestVideo } from "@/lib/queries";

// modelId is a finite set of supported Qwen2.5-VL sizes — a Select, not free
// text. The 3B default is ungated and runs on CPU; 7B is heavier.
const MODEL_OPTIONS = [
  { value: "Qwen/Qwen2.5-VL-3B-Instruct", label: "Qwen2.5-VL 3B (default, ungated)" },
  { value: "Qwen/Qwen2.5-VL-7B-Instruct", label: "Qwen2.5-VL 7B (heavier, GPU recommended)" },
] as const;

const addVideoSchema = z.object({
  file: z
    .instanceof(File, { message: "Select a video file" })
    .refine((f) => /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name), "Must be a video file"),
});

type AddVideoValues = z.infer<typeof addVideoSchema>;

interface AddVideoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddVideoForm({ open, onOpenChange }: AddVideoFormProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const ingest = useIngestVideo();
  const form = useForm<AddVideoValues>({ resolver: zodResolver(addVideoSchema) });

  const onSubmit = async (values: AddVideoValues) => {
    try {
      const video = await ingest.mutateAsync({
        file: values.file,
        onProgress: setProgress,
      });
      const wasReplaced = video.has_meta || video.chapter_count > 0;
      toast.success(
        wasReplaced
          ? `Replaced existing video "${video.title}" in the library`
          : `Added "${video.title}" to the library`,
        { description: "Open it and run Chapterize to generate chapters." },
      );
      form.reset();
      setProgress(null);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingest failed";
      toast.error(`Couldn't add video: ${message}`);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a video</DialogTitle>
          <DialogDescription>
            Upload a short clip to your B2 library. Large production videos can
            also be dropped directly into B2 under{" "}
            <code className="font-mono text-xs">library/source/</code> and they
            appear here automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange } }) => (
                <FormItem>
                  <FormLabel>Video file</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm,.mkv"
                      onChange={(e) => onChange(e.target.files?.[0])}
                    />
                  </FormControl>
                  <FormDescription>
                    Tip: a 5&ndash;15 min clip works best for an on-device demo
                    run. You&apos;ll pick sampling &amp; chapter count when you
                    chapterize it.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Default model
              </p>
              {/* Surfaced as guidance, not an autofill — the actual run is
                  configured on the detail page after ingest. */}
              <Select disabled value={MODEL_OPTIONS[0].value}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                Runs locally on CPU by default (CUDA / Apple MPS auto-detected).
                No API key needed.
              </p>
            </div>

            {progress !== null && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Uploading&hellip; {progress}%
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={ingest.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={ingest.isPending}>
                {ingest.isPending ? "Adding..." : "Add to library"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
