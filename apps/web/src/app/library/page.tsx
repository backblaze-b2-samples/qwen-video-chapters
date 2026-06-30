import { LibraryGrid } from "@/components/library/library-grid";

export default function LibraryPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Library</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Your B2-backed video library. Each clip lives under{" "}
          <code className="font-mono text-xs">library/source/</code>; chapterize
          it to generate keyframe thumbnails, chapter timestamps and an
          AI-written summary, all stored back in B2.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <LibraryGrid />
      </div>
    </div>
  );
}
