import { useEffect } from 'react'

export function carriesFiles(data: DataTransfer): boolean {
  return Array.from(data.types).includes('Files')
}

/** Outside a drop target, a file must not navigate away and discard unsaved work. */
export function usePreventFileNavigation(): void {
  useEffect(() => {
    const ignoreFiles = (event: DragEvent): void => {
      if (event.dataTransfer && carriesFiles(event.dataTransfer)) {
        event.preventDefault()
      }
    }
    window.addEventListener('dragover', ignoreFiles)
    window.addEventListener('drop', ignoreFiles)
    return () => {
      window.removeEventListener('dragover', ignoreFiles)
      window.removeEventListener('drop', ignoreFiles)
    }
  }, [])
}
