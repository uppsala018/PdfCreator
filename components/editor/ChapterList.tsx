"use client"

import { useState, useRef, useEffect } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Plus, Trash2, GripVertical, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Chapter } from "@/lib/project-schema"

interface ChapterListProps {
  chapters: Chapter[]
  selectedChapterId: string | null
  dirtyChapterIds: Set<string>
  onSelectChapter: (id: string) => void
  onAddChapter: () => void
  onDeleteChapter: (id: string) => void
  onRenameChapter: (id: string, title: string) => void
  onReorderChapters: (chapters: Chapter[]) => void
}

// ─── Single sortable chapter item ────────────────────────────────────────────

interface ChapterItemProps {
  chapter: Chapter
  isSelected: boolean
  isDirty: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (title: string) => void
}

function ChapterItem({
  chapter,
  isSelected,
  isDirty,
  onSelect,
  onDelete,
  onRename,
}: ChapterItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id })

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(chapter.title)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the input when we enter edit mode.
  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  function commitRename() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== chapter.title) {
      onRename(trimmed)
    } else {
      setEditValue(chapter.title)
    }
    setIsEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitRename()
    if (e.key === "Escape") {
      setEditValue(chapter.title)
      setIsEditing(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={cn(
        "group/chapter flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm cursor-pointer",
        "transition-colors",
        isSelected
          ? "bg-[#C9A84C]/10 text-white"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      )}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="shrink-0 touch-none text-slate-700 hover:text-slate-400 transition-colors cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        {...listeners}
        {...attributes}
        aria-label="Drag to reorder chapter"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Title or rename input */}
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-[#0D1B2A] border border-[#C9A84C]/50 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#C9A84C]"
        />
      ) : (
        <span
          className="flex-1 min-w-0 truncate text-xs font-medium"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditValue(chapter.title)
            setIsEditing(true)
          }}
          title={`${chapter.title} (double-click to rename)`}
        >
          {chapter.title}
        </span>
      )}

      {/* Dirty indicator */}
      {isDirty && !isEditing && (
        <span
          className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#C9A84C]"
          title="Unsaved changes"
        />
      )}

      {/* Delete button */}
      {!isEditing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="shrink-0 rounded p-0.5 text-slate-700 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover/chapter:opacity-100 transition-all"
          aria-label="Delete chapter"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ─── Chapter list ─────────────────────────────────────────────────────────────

export default function ChapterList({
  chapters,
  selectedChapterId,
  dirtyChapterIds,
  onSelectChapter,
  onAddChapter,
  onDeleteChapter,
  onRenameChapter,
  onReorderChapters,
}: ChapterListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = chapters.findIndex((c) => c.id === active.id)
      const newIdx = chapters.findIndex((c) => c.id === over.id)
      onReorderChapters(arrayMove(chapters, oldIdx, newIdx))
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e3a52] shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">
          <BookOpen className="h-3.5 w-3.5" />
          Chapters
        </div>
        <button
          type="button"
          onClick={onAddChapter}
          className="rounded p-1 text-slate-500 hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors"
          aria-label="Add chapter"
          title="Add chapter"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sortable list */}
      <div className="flex-1 overflow-y-auto py-1 px-1.5">
        {chapters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-3">
            <p className="text-xs text-slate-600">No chapters yet</p>
            <button
              type="button"
              onClick={onAddChapter}
              className="mt-2 text-xs text-[#C9A84C] hover:underline"
            >
              Add first chapter
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={chapters.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {chapters.map((chapter) => (
                <ChapterItem
                  key={chapter.id}
                  chapter={chapter}
                  isSelected={chapter.id === selectedChapterId}
                  isDirty={dirtyChapterIds.has(chapter.id)}
                  onSelect={() => onSelectChapter(chapter.id)}
                  onDelete={() => onDeleteChapter(chapter.id)}
                  onRename={(title) => onRenameChapter(chapter.id, title)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Footer: chapter count */}
      <div className="shrink-0 border-t border-[#1e3a52] px-3 py-2 text-[10px] text-slate-700">
        {chapters.length} chapter{chapters.length !== 1 ? "s" : ""}
      </div>
    </div>
  )
}
