"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ChapterizeRequest, SamplingMode } from "@qwen-video-chapters/shared";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { GeneratingLoader } from "@/components/ui/generating-loader";
import { useChapterize, useChapterizeProgress, useRunDefaults } from "@/lib/queries";

const MODEL_OPTIONS = [
  { value: "Qwen/Qwen2.5-VL-3B-Instruct", label: "Qwen2.5-VL 3B (default, ungated)" },
  { value: "Qwen/Qwen2.5-VL-7B-Instruct", label: "Qwen2.5-VL 7B (heavier, GPU recommended)" },
];
const CHAPTER_OPTIONS = [4, 8, 12];

interface RunChaptersFormProps {
  videoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The run/re-run action. Reuses the selector fields from create, opening
 * pre-filled with the video's last-used settings (or defaults if first run).
 * All finite-option fields are selectors, never free text. */
export function RunChaptersForm({ videoId, open, onOpenChange }: RunChaptersFormProps) {
  const { data: defaults } = useRunDefaults(videoId, open);
  const chapterize = useChapterize(videoId);
  const { data: progress } = useChapterizeProgress(videoId, chapterize.isPending);

  // User overrides start undefined; we fall back to the video's last-used
  // settings (or defaults) so the form opens pre-filled WITHOUT a setState
  // effect (which the lint rule forbids).
  const [samplingOverride, setSampling] = useState<SamplingMode>();
  const [maxChaptersOverride, setMaxChapters] = useState<number>();
  const [modelIdOverride, setModelId] = useState<string>();

  const sampling = samplingOverride ?? defaults?.sampling ?? "scene-change";
  const maxChapters =
    maxChaptersOverride ??
    (defaults && CHAPTER_OPTIONS.includes(defaults.max_chapters)
      ? defaults.max_chapters
      : 8);
  const modelId =
    modelIdOverride ?? defaults?.model_id ?? MODEL_OPTIONS[0].value;

  const onRun = async () => {
    const req: ChapterizeRequest = {
      sampling,
      max_chapters: maxChapters,
      model_id: modelId,
    };
    try {
      const result = await chapterize.mutateAsync(req);
      toast.success(`Generated ${result.chapters.length} chapters`);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chapterize failed";
      toast.error(`Chapterize failed: ${message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !chapterize.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chapterize video</DialogTitle>
          <DialogDescription>
            Extract keyframes and run Qwen2.5-VL locally to generate chapters,
            titles and a summary. Tip: <code>scene-change</code> sampling with 8
            chapters works well for a 5&ndash;15 min clip.
          </DialogDescription>
        </DialogHeader>

        {chapterize.isPending ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <GeneratingLoader size="lg" label={progress?.detail ?? "Generating chapters…"} />
            <p className="max-w-xs text-center text-xs text-muted-foreground">
              {progress?.stage === "downloading_model"
                ? "Downloading model weights (~3 GB on first run). Grab a coffee — this only happens once."
                : "Running on-device. On CPU this takes a minute or two."}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Sampling</Label>
              <RadioGroup
                value={sampling}
                onValueChange={(v) => setSampling(v as SamplingMode)}
                className="flex gap-6"
              >
                {(["scene-change", "interval"] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-sm capitalize">
                    <RadioGroupItem value={mode} />
                    {mode.replace("-", " ")}
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Max chapters</Label>
              <Select
                value={String(maxChapters)}
                onValueChange={(v) => setMaxChapters(Number(v))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAPTER_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} chapters
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger>
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
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={onRun}>
                Chapterize
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
