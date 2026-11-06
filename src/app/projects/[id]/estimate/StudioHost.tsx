import { useEffect } from 'react'
import App from '@/studio/App'
import { studioDocumentCss, type StudioMount } from '@/studio/embed'

export function StudioHost(props: StudioMount) {
  const css = studioDocumentCss()
  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.uqStudio = '1'
    style.textContent = css
    document.head.append(style)
    return () => style.remove()
  }, [css])

  return (
    <div className="studio-root h-full min-h-0">
      <App embed={props} />
    </div>
  )
}
