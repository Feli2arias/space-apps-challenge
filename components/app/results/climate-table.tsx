// Contract: ClimateTable
// Props: data (ClimateData, required) — monthly mean, maximum and minimum temperature, and the
//          altitude the product assumes for its grid cell
//        dict (ResultsDictionary, required)
// Variants: none
// States: default (12 rows, January first) | a cell with no value (the words "sin dato",
//         never a 0) | no months (a sentence instead of the table) |
//         grid-cell altitude unknown (that sentence is left out)
// Accessibility: a real table with column and row headers; the unit is stated once above it
// Responsive: four columns of short numbers; from 320px up

import { formatNumber, formatValueWithUnit, monthName } from "@/lib/analysis/format";
import type { ClimateData, ClimateMonth } from "@/lib/analysis/types";
import { fill, type ResultsDictionary } from "@/lib/i18n/app/results";
import { cn } from "@/lib/cn";

interface ClimateTableProps {
  readonly data: ClimateData;
  readonly dict: ResultsDictionary;
}

/** Decimals for temperatures in °C, the same as the metric cards. */
const TEMPERATURE_DECIMALS = 1;

const COLUMNS = ["meanTemperatureC", "maxTemperatureC", "minTemperatureC"] as const;

export function ClimateTable({ data, dict }: ClimateTableProps) {
  const { climate, locale } = dict;
  const months: readonly ClimateMonth[] = [...(data.monthly ?? [])].sort(
    (first, second) => first.month - second.month,
  );
  // Altitude stays in metres whatever its size: "1 234 m", never "1,2 km".
  const gridElevation = formatValueWithUnit(data.gridCellElevationMeters, "m", locale);
  const headClass = "py-2 pr-2 font-mono text-label tracking-label text-muted uppercase";
  const columnLabels = [climate.columnMean, climate.columnMax, climate.columnMin];

  return (
    <div>
      <h4 className="font-mono text-label tracking-label text-cinnabar-deep uppercase">
        {climate.tableTitle}
      </h4>

      {months.length === 0 ? (
        <p className="mt-2 text-small text-muted">{climate.empty}</p>
      ) : (
        <>
          <p className="mt-1.5 text-small text-muted">{climate.unitNote}</p>
          <table className="mt-2 w-full border-collapse text-small tabular-nums">
            <thead>
              <tr className="border-b border-ink">
                <th scope="col" className={cn(headClass, "text-left")}>{climate.columnMonth}</th>
                {columnLabels.map((label) => (
                  <th key={label} scope="col" className={cn(headClass, "text-right last:pr-0")}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((entry) => (
                <tr key={entry.month} className="border-b border-line">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                    {monthName(entry.month, locale, "long") ?? entry.month}
                  </th>
                  {COLUMNS.map((column) => {
                    const value = formatNumber(entry[column], locale, TEMPERATURE_DECIMALS);
                    return (
                      <td
                        key={column}
                        className={cn("py-1.5 pr-2 text-right last:pr-0", value === null && "text-muted")}
                      >
                        {value ?? dict.missing}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {gridElevation ? (
        <p className="mt-3 text-small text-muted">
          {fill(climate.gridElevation, { elevation: gridElevation })}
        </p>
      ) : null}
    </div>
  );
}
