import { QuartzTransformerPlugin } from "../types"
export const WordCount: QuartzTransformerPlugin = () => ({
  name: "WordCount",
  markdownPlugins() {
    return [() => (_tree, file) => {
      const text = String(file.value ?? "")
      file.data.wordcount = text.trim().split(/\s+/).length
    }]
  },
})
declare module "vfile" {
  interface DataMap { wordcount?: number }
}
