// Contract: SoilTable
// Props: data (SoilData, required) — one mean per property and depth
//        dict (ResultsDictionary, required)
// Variants: none
// States: default | a cell with no value (the words "sin dato", muted, never a 0) |
//         a property or depth the panel has no name for (its raw key) |
//         no layers (a sentence instead of the table)
// Accessibility: a real table with a caption-like heading, column headers for depths and
//                row headers for properties; every cell carries its unit
// Responsive: four narrow columns that wrap their text; scrolls sideways inside its own box
//             only if a value cannot wrap; from 320px up

import { formatValueWithUnit } from "@/lib/analysis/format";
import type { SoilData, SoilDepth, SoilLayer, SoilProperty } from "@/lib/analysis/types";
import type { ResultsDictionary } from "@/lib/i18n/app/results";
import { cn } from "@/lib/cn";

interface SoilTableProps {
  readonly data: SoilData;
  readonly dict: ResultsDictionary;
}

/** Display order: texture first, then chemistry; shallow to deep. */
const PROPERTY_ORDER: readonly SoilProperty[] = ["clay", "sand", "silt", "phh2o", "soc"];
const DEPTH_ORDER: readonly SoilDepth[] = ["0-5cm", "5-15cm", "15-30cm"];

/** Keeps the known order and appends anything the panel has not seen before. */
function orderedKeys<T extends string>(present: readonly T[], order: readonly T[]): readonly T[] {
  const unique = Array.from(new Set(present));
  return [...order.filter((key) => unique.includes(key)), ...unique.filter((key) => !order.includes(key))];
}

function nameOf(table: Readonly<Record<string, string>>, key: string): string {
  return Object.hasOwn(table, key) ? table[key] : key;
}

export function SoilTable({ data, dict }: SoilTableProps) {
  const { soil, locale } = dict;
  const layers: readonly SoilLayer[] = data.layers ?? [];
  const properties = orderedKeys(layers.map((layer) => layer.property), PROPERTY_ORDER);
  const depths = orderedKeys(layers.map((layer) => layer.depth), DEPTH_ORDER);
  const headClass = "py-2 pr-2 text-left align-bottom font-mono text-label tracking-label text-muted uppercase";

  return (
    <div>
      <h4 className="font-mono text-label tracking-label text-cinnabar-deep uppercase">
        {soil.tableTitle}
      </h4>

      {layers.length === 0 ? (
        <p className="mt-2 text-small text-muted">{soil.empty}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-small tabular-nums">
            <thead>
              <tr className="border-b border-ink">
                <th scope="col" className={headClass}>{soil.columnProperty}</th>
                {depths.map((depth) => (
                  <th key={depth} scope="col" className={cn(headClass, "text-right last:pr-0")}>
                    {nameOf(soil.depths, depth)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property} className="border-b border-line">
                  <th scope="row" className="py-2 pr-2 text-left font-normal">
                    {nameOf(soil.properties, property)}
                  </th>
                  {depths.map((depth) => {
                    const layer = layers.find(
                      (candidate) => candidate.property === property && candidate.depth === depth,
                    );
                    const value = layer ? formatValueWithUnit(layer.mean, layer.unit, locale) : null;
                    return (
                      <td
                        key={depth}
                        className={cn("py-2 pr-2 text-right last:pr-0", value === null && "text-muted")}
                      >
                        {value ?? dict.missing}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
