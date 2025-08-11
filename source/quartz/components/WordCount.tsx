import { QuartzComponentConstructor, QuartzComponentProps } from "./types"

export default (( ) => {
  function WordCount({ fileData }: QuartzComponentProps) {
    const wc = (fileData as any).wordcount ?? 0
    return <span class="wc">~{wc} words</span>
  }
  WordCount.css = `.wc { opacity:.7; font-size:.9em; }`
  WordCount.afterDOMLoaded = `
    document.addEventListener("nav", () => {
      // page-specific setup if needed; cleaned up on SPA nav automatically
    })
  `
  return WordCount
}) satisfies QuartzComponentConstructor
