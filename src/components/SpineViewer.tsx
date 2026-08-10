import { SpineCanvas } from "./SpineCanvas";
import { SpineControlPanel } from "./SpineControlPanel";

export function SpineViewer() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <main className="relative flex-1 min-w-0 h-full bg-[#090d16]">
        <SpineCanvas />
      </main>
      <aside className="w-100 shrink-0 h-full border-l border-border bg-card overflow-y-auto">
        <SpineControlPanel />
      </aside>
    </div>
  );
}
