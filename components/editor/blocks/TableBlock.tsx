"use client"

import { Plus, Trash2 } from "lucide-react"
import BlockWrapper from "./BlockWrapper"
import { cn } from "@/lib/utils"
import type { Block, BlockMetadata } from "@/lib/project-schema"

interface Props {
  block: Block
  onChange: (updates: { content?: string; metadata?: BlockMetadata }) => void
  onDelete: () => void
  dragHandle?: React.ReactNode
}

export default function TableBlock({ block, onChange, onDelete, dragHandle }: Props) {
  const rows: string[][] = block.metadata?.rows ?? [
    ["Column 1", "Column 2"],
    ["", ""],
  ]

  function updateCell(rowIdx: number, colIdx: number, value: string) {
    const next = rows.map((r, ri) =>
      r.map((c, ci) => (ri === rowIdx && ci === colIdx ? value : c))
    )
    onChange({ metadata: { ...block.metadata, rows: next } })
  }

  function addRow() {
    const colCount = rows[0]?.length ?? 2
    onChange({
      metadata: {
        ...block.metadata,
        rows: [...rows, Array<string>(colCount).fill("")],
      },
    })
  }

  function deleteRow(rowIdx: number) {
    const next = rows.filter((_, i) => i !== rowIdx)
    onChange({
      metadata: {
        ...block.metadata,
        rows: next.length > 0 ? next : [Array<string>(rows[0]?.length ?? 2).fill("")],
      },
    })
  }

  function addColumn() {
    const next = rows.map((r) => [...r, ""])
    onChange({ metadata: { ...block.metadata, rows: next } })
  }

  function deleteColumn(colIdx: number) {
    const next = rows.map((r) =>
      r.filter((_, i) => i !== colIdx).length > 0
        ? r.filter((_, i) => i !== colIdx)
        : [""]
    )
    onChange({ metadata: { ...block.metadata, rows: next } })
  }

  const colCount = rows[0]?.length ?? 0

  return (
    <BlockWrapper type="table" onDelete={onDelete} dragHandle={dragHandle}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="group/row">
                {row.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    className={cn(
                      "border border-[#1e3a52] p-0",
                      rowIdx === 0 && "bg-[#0D1B2A]"
                    )}
                  >
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                      placeholder={rowIdx === 0 ? `Col ${colIdx + 1}` : ""}
                      className={cn(
                        "w-full bg-transparent px-2.5 py-1.5 focus:outline-none",
                        rowIdx === 0
                          ? "font-semibold text-white"
                          : "text-slate-300",
                        "placeholder:text-slate-700"
                      )}
                    />
                  </td>
                ))}
                {/* Row delete */}
                <td className="w-6 border-0 pl-1">
                  <button
                    type="button"
                    onClick={() => deleteRow(rowIdx)}
                    disabled={rows.length === 1}
                    className="rounded p-0.5 text-slate-700 hover:text-red-400 opacity-0 group-hover/row:opacity-100 transition-all disabled:pointer-events-none"
                    title="Delete row"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Column delete row */}
      {colCount > 1 && (
        <div className="mt-1 flex gap-0">
          {Array.from({ length: colCount }).map((_, colIdx) => (
            <div key={colIdx} className="flex-1 flex justify-center">
              <button
                type="button"
                onClick={() => deleteColumn(colIdx)}
                className="rounded p-0.5 text-slate-700 hover:text-red-400 transition-colors opacity-0 hover:opacity-100 group-hover/block:opacity-100"
                title={`Delete column ${colIdx + 1}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="w-6" />
        </div>
      )}

      {/* Add row / add column */}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add row
        </button>
        <button
          type="button"
          onClick={addColumn}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add column
        </button>
      </div>
    </BlockWrapper>
  )
}
