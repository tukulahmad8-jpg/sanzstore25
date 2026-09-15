import { useRef, useState } from 'react'
import { ImagePlus, GripVertical, X } from 'lucide-react'

export interface ProductImageDraft {
  id: string
  url: string
  file?: File
  uploaded?: boolean
}

interface ProductImageUploaderProps {
  images: ProductImageDraft[]
  onChange: (images: ProductImageDraft[]) => void
}

export function ProductImageUploader({ images, onChange }: ProductImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function addFiles(files: FileList | File[]) {
    const next = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        id: `${file.name}-${file.size}-${
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        }`,
        file,
        url: URL.createObjectURL(file),
        uploaded: false,
      }))

    onChange([...images, ...next].slice(0, 10))
  }

  function removeImage(id: string) {
    onChange(images.filter((image) => image.id !== id))
  }

  function setCover(index: number) {
    const next = [...images]
    const [selected] = next.splice(index, 1)
    next.unshift(selected)
    onChange(next)
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return
    const next = [...images]
    const [dragged] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, dragged)
    setDragIndex(null)
    onChange(next)
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          addFiles(event.dataTransfer.files)
        }}
        className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-brand bg-brand/10 p-6 text-center text-brand transition hover:bg-brand/15"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files)
            event.currentTarget.value = ''
          }}
        />
        <span>
          <ImagePlus className="mx-auto mb-2 h-8 w-8" />
          <b className="block">Tambah Foto Produk</b>
          <small className="text-[var(--seller-muted)]">
            Drag foto ke sini atau klik untuk upload. Foto pertama menjadi cover.
          </small>
        </span>
      </button>

      {images.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {images.map((image, index) => (
            <div
              key={image.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(index)}
              className={`group relative overflow-hidden rounded-2xl border bg-[var(--seller-surface)] ${
                index === 0 ? 'border-brand ring-2 ring-brand/20' : 'border-[var(--seller-line)]'
              }`}
            >
              <img src={image.url} alt="" className="aspect-square w-full object-cover" />

              <div className="absolute left-2 top-2 flex gap-1">
                <span className="rounded-full bg-brand px-2 py-1 text-xs font-black text-white">
                  {index === 0 ? 'Cover' : `Foto ${index + 1}`}
                </span>
              </div>

              <button
                type="button"
                onClick={() => removeImage(image.id)}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
              >
                <X size={15} />
              </button>

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 p-2 text-xs text-white">
                <span className="inline-flex items-center gap-1">
                  <GripVertical size={14} />
                  Drag
                </span>
                {index !== 0 ? (
                  <button type="button" onClick={() => setCover(index)} className="font-bold">
                    Jadikan Cover
                  </button>
                ) : (
                  <b>Cover Utama</b>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
