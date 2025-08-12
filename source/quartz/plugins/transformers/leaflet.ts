import { QuartzTransformerPlugin } from "../types";
import { visit } from "unist-util-visit";
import yaml from "js-yaml";

type LatLngTuple = [number, number]
type Bounds = any[]

type MarkerSpec = {
  lat?: number
  lng?: number
  link?: string
  popup?: string
  desc?: string // alias for popup
}

type ImageOverlaySpec = {
  url: string
  bounds: Bounds
  opacity?: number
  zIndex?: number
  name?: string
}

type TileLayerSpec = {
  template: string
  name?: string
  attribution?: string
}

type MapSpec = {
  id: string
  height: string
  width: string
  lat: number
  lng: number
  bounds: Bounds
  minZoom?: number
  maxZoom?: number
  defaultZoom: number
  zoomDelta?: number
  unit?: "metric" | "imperial" | "both"
  scale?: boolean
  recenter?: boolean
  darkMode?: boolean
  tileServer?: (string | TileLayerSpec)[] | string | TileLayerSpec
  overlay?: (string | TileLayerSpec)[]
  images?: string;
  markers?: MarkerSpec[]
}

const num = (v: any) =>
  v === undefined || v === null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v)


function parseTileEntry(raw: any): TileLayerSpec | undefined {
  if (!raw) return undefined
  if (typeof raw === "object" && raw.template) return raw as TileLayerSpec
  // "https://{s}.tile.../{z}/{x}/{y}.png|Alias|Attribution"
  const [template, name, attribution] = String(raw).split("|").map((s) => s.trim())
  return { template, name, attribution }
}

function parseTileList(raw: any): TileLayerSpec[] | undefined {
  if (!raw) return undefined
  const list = Array.isArray(raw) ? raw : [raw]
  const out = list.map(parseTileEntry).filter(Boolean) as TileLayerSpec[]
  return out.length ? out : undefined
}

function parseMarkers(raw: any): MarkerSpec[] | undefined {
  if (!raw) return undefined
  const list = Array.isArray(raw) ? raw : [raw]
  const out: MarkerSpec[] = list.map((item) => {
    if (typeof item === "object" && !Array.isArray(item)) {
      const m = item as any
      return {
        lat: num(m.lat),
        lng: num(m.lng ?? m.long),
        link: m.link,
        popup: m.popup ?? m.desc,
      }
    }
    // array or CSV: [type?, lat, lng, link?, desc?]
    const arr = (Array.isArray(item) ? item : String(item).split(",")).map((s) => String(s).trim())
    return {
      lat: num(arr[1] ?? arr[0]),
      lng: num(arr[2] ?? arr[1]),
      link: arr[3],
      popup: arr[4],
    }
  })
  return out.filter((m) => typeof m.lat === "number" && typeof m.lng === "number")
}

function normalizeImages(base: any) {
    return '/z_assets/' + base.image;
}

export const LeafletBlocks: QuartzTransformerPlugin = () => ({
  name: "LeafletBlocks",
  markdownPlugins() {
    return [
      () =>
        (tree: any, _file: any) => {
          visit(tree, "code", (node: any, index: number | undefined, parent: any) => {
            if (!node?.lang || node.lang.toLowerCase() !== "leaflet" || parent == null || index === undefined) return

            let base: any = {}
            try {
              base = yaml.load(String(node.value ?? "")) ?? {}
            } catch {
              base = {}
            }

            const spec: MapSpec = {
              id: base.id,
              height: base.height ?? "500px",
              width: base.width ?? "100%",
              lat: base.lat,
              lng: base.long,
              bounds: base.bounds,
              minZoom: num(base.minZoom),
              maxZoom: num(base.maxZoom),
              defaultZoom: num(base.defaultZoom) ?? 5,
              zoomDelta: num(base.zoomDelta),
              unit: (base.unit ?? "metric") as MapSpec["unit"],
              scale: base.scale !== false, // default true
              recenter: !!base.recenter,
              darkMode: !!base.darkMode,
              tileServer: parseTileList(base.tileServer) ?? parseTileList(base.tiles),
              overlay: parseTileList(base.overlay),
              images: normalizeImages(base),
              markers: parseMarkers(base.marker ?? base.markers),
            }

            // const payload = Buffer.from(JSON.stringify(spec), "utf8").toString("base64")
            const payload = Buffer.from(JSON.stringify(spec), "utf8").toString("base64");
            const html = `<div class="qz-leaflet" id="${spec.id}" style="height:${spec.height};width:${spec.width}" aria-label="Interactive map${spec.id ? `: ${spec.id}` : ""}"></div>
                <script type="text/javascript">
                var obsidianInfo = {
                    id: ${spec.id},
                    height: ${spec.height},
                    width: ${spec.width},
                    lat: ${spec.lat},
                    lng: ${spec.lng},
                    bounds: ${spec.bounds},
                    minZoom: ${spec.minZoom},
                    maxZoom: ${spec.maxZoom},
                    defaultZoom: ${spec.defaultZoom},
                    zoomDelta: ${spec.zoomDelta},
                    unit: ${spec.unit},
                    scale: ${spec.scale}, 
                    recenter: ${spec.recenter},
                    darkMode: ${spec.darkMode},
                    tileServer: ${spec.tileServer},
                    overlay: ${spec.overlay},
                    images: ${spec.images},
                    markers: ${spec.markers}
                };
                var getUrl = window.location;
                baseUrl = getUrl.protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
                </script>`
            const js = `
            <script type="text/javascript">
                var map = L.map('${spec.id}', {
                    center: [${spec.lat/1000}, ${spec.lng/1000}],
                    zoom: ${spec.defaultZoom*-1.5}
                });
                var imageUrl = '${spec.images}',
                    imageBounds = [[${spec.bounds?.[0]}],[${spec.bounds?.[1]?.[0]/1000}, ${spec.bounds?.[1]?.[1]/1000}]];
                L.imageOverlay(imageUrl, imageBounds).addTo(map);
            </script>`


            parent.children[index] = { type: "html", value: html }
            parent.children[index + 1] = { type: "html", value: js }
          })
        },
    ]
  },

})