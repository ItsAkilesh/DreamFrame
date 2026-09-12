"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface AnimationOption { id: string; name: string }

export function AnimationPicker({animations, value, disabled, onChange}: {
  animations: AnimationOption[];
  value: string | null;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = animations.find((animation) => animation.id === value);
  const filtered = useMemo(() => animations.filter((animation) =>
    `${animation.name} ${animation.id}`.toLowerCase().includes(query.toLowerCase())
  ), [animations, query]);
  const choose = (id: string | null) => { onChange(id); setOpen(false); setQuery(""); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" />} disabled={disabled} aria-label="Choose animation" className="max-w-56">
        <span className="truncate">{selected?.name ?? "Bind pose"}</span>
        <ChevronsUpDown className="size-3.5 shrink-0" />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 gap-1 p-1">
        <Input aria-label="Search animations" placeholder="Search animations…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div aria-label="Animations" className="h-40 overflow-y-auto overscroll-contain">
          <button type="button" onClick={() => choose(null)} className="hover:bg-accent focus-visible:bg-accent flex h-8 w-full items-center rounded-md px-2 text-sm outline-none">
            <span className="flex-1 text-left">Bind pose</span>{!value && <Check className="size-4" />}
          </button>
          {filtered.map((animation) => (
            <button key={animation.id} type="button" onClick={() => choose(animation.id)} aria-pressed={animation.id === value} className="hover:bg-accent focus-visible:bg-accent flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm outline-none">
              <span className="truncate text-left" title={animation.name}>{animation.name}</span>
              {animation.id === value && <Check className="ml-auto size-4 shrink-0" />}
            </button>
          ))}
          {!filtered.length && <p className="text-muted-foreground p-2 text-sm">No matching animations.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
