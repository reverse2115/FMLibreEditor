import type { CSSProperties } from "react";
import { profileText } from "./labels";

/** Current or potential ability (1–200) with a bar; negative potentials are ranges. */
export function Ability({ value }: { value: number }) {
  if (value < 0) {
    return (
      <span className="ability range" title={profileText.potentialRange}>
        {value}
      </span>
    );
  }
  const style = { "--fill": `${Math.min(100, value / 2)}%` } as CSSProperties;
  // This fork colours an ability by how high it is, in four bands (see bob-theme.css).
  const level = value >= 150 ? 4 : value >= 120 ? 3 : value >= 80 ? 2 : 1;
  return (
    <span className={`ability level-${level}`} style={style}>
      {value}
    </span>
  );
}
