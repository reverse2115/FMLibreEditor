// Upgrade for a position: the dialog the button beside Max attributes opens on a player's profile. The user picks a
// position and a current ability to reach; the dialog works out which attributes to raise, the ones that count most
// for the position and are furthest behind first, and shows every change before anything is written. Nothing is ever
// lowered. Current ability is written with the attributes, as the game ties the two together, and potential ability
// only when it would otherwise be below the new current ability. Each change is logged like any edit, so the Changes
// view can undo it. The weights and the level an ability stands for are this fork's estimates (`positionWeights.ts`).

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { applyEdits, editFields, editFor, readValues, shownValue } from "./editing";
import { describeError } from "./format";
import { fieldLabel } from "./labels";
import { levelFor, POSITIONS, type PositionChoice } from "./positionWeights";
import type { EditField, FieldEdit, FieldValues } from "./types";
import { useModal } from "./useModal";

interface PositionUpgradeDialogProps {
  uid: number;
  name: string;
  /** Called once anything is written: the game has changed, so the profile reads it again. */
  onEdited: () => void;
  onClose: () => void;
}

/** One attribute the upgrade raises, as the game shows it (1–20). */
interface Row {
  key: string;
  before: number;
  after: number;
}

/** What an upgrade would write, and what the dialog says about it. */
interface Plan {
  rows: Row[];
  edits: FieldEdit[];
  ability: { before: number; after: number };
  /** Null when potential ability stays as it is. */
  potential: { before: number; after: number } | null;
  /** Null when the position's rating stays as it is. */
  rating: { before: number; after: number } | null;
  /** False when every attribute of the position is at 20 and the level is still not reached. */
  reached: boolean;
}

/** A player counts as playing a position already from this rating: his own attributes then set the level. */
const PLAYS_FROM = 15;

/** Most the level may be moved by how the player himself compares with the estimate. */
const MOST_OFFSET = 3;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** The rating (1–20) of `values` at the position `key`; null when the field cannot be read now. */
function ratingAt(fields: Map<string, EditField>, values: FieldValues, key: string): number | null {
  const field = fields.get(`position.${key}`);
  const stored = values[`position.${key}`];
  return field === undefined || stored === undefined ? null : shownValue(field, stored);
}

/** The upgrade of the player with `values` for `position` up to the current ability `target`; null if he has none. */
function planFor(
  fields: Map<string, EditField>,
  values: FieldValues,
  position: PositionChoice,
  target: number,
  makeNatural: boolean,
): Plan | null {
  const abilityField = fields.get("current_ability");
  const abilityNow = values["current_ability"];
  if (abilityField === undefined || abilityNow === undefined) {
    return null;
  }

  const attributes = Object.entries(position.weights).flatMap(([name, weight]) => {
    const key = `attribute.${name}`;
    const field = fields.get(key);
    const stored = values[key];
    if (field === undefined || stored === undefined || weight <= 0) {
      return [];
    }
    const now = shownValue(field, stored);
    return [{ key, field, stored, weight, now, next: now }];
  });
  const totalWeight = attributes.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight === 0) {
    return null;
  }
  let weighted = attributes.reduce((sum, a) => sum + a.weight * a.now, 0);

  // Someone who plays there already shows how the game rates him: the level moves by as much as he differs from the
  // estimate for his own ability, so that a rise of ten points of ability is a rise of ten for him too.
  const rating = ratingAt(fields, values, position.key);
  const offset =
    rating !== null && rating >= PLAYS_FROM
      ? clamp(weighted / totalWeight - levelFor(abilityNow), -MOST_OFFSET, MOST_OFFSET)
      : 0;
  const goal = Math.min(20, levelFor(target) + offset);

  // One point at a time, to the attribute where a point is worth most: a high weight and far from 20.
  let reached = weighted / totalWeight >= goal;
  for (let step = 0; !reached && step < 2000; step++) {
    let best: (typeof attributes)[number] | null = null;
    for (const attribute of attributes) {
      if (attribute.next >= 20) {
        continue;
      }
      if (best === null || attribute.weight * (20 - attribute.next) > best.weight * (20 - best.next)) {
        best = attribute;
      }
    }
    if (best === null) {
      break;
    }
    best.next += 1;
    weighted += best.weight;
    reached = weighted / totalWeight >= goal;
  }

  const edits: FieldEdit[] = [];
  const abilityAfter = clamp(Math.max(abilityNow, target), abilityField.min, abilityField.max);

  // Potential first: it must not be below the current ability that follows. A negative one is a range the game has
  // not settled yet, and is left alone.
  const potentialNow = values["potential_ability"];
  let potential: Plan["potential"] = null;
  if (fields.has("potential_ability") && potentialNow !== undefined && potentialNow >= 0 && potentialNow < abilityAfter) {
    potential = { before: potentialNow, after: abilityAfter };
    edits.push({ field: "potential_ability", value: abilityAfter });
  }
  if (abilityAfter !== abilityNow) {
    edits.push({ field: "current_ability", value: abilityAfter });
  }

  const rows: Row[] = [];
  for (const attribute of [...attributes].sort((a, b) => b.weight - a.weight)) {
    const edit = editFor(attribute.field, attribute.stored, attribute.next);
    if (edit !== null) {
      edits.push(edit);
      rows.push({ key: attribute.key, before: attribute.now, after: attribute.next });
    }
  }

  let newRating: Plan["rating"] = null;
  const ratingField = fields.get(`position.${position.key}`);
  if (makeNatural && ratingField !== undefined && rating !== null && rating < ratingField.max) {
    newRating = { before: rating, after: ratingField.max };
    edits.push({ field: ratingField.key, value: ratingField.max });
  }

  return {
    rows,
    edits,
    ability: { before: abilityNow, after: abilityAfter },
    potential,
    rating: newRating,
    reached,
  };
}

/** The band (1–4) of a 1–20 value, as the profile colours it. */
const tier = (value: number): number => (value >= 16 ? 4 : value >= 11 ? 3 : value >= 6 ? 2 : 1);

export function PositionUpgradeDialog({ uid, name, onEdited, onClose }: PositionUpgradeDialogProps) {
  const base = useId();
  const id = (part: string) => `${base}-${part}`;
  const dialog = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const running = useRef(false);
  const [fields, setFields] = useState<Map<string, EditField> | null>(null);
  const [values, setValues] = useState<FieldValues | null>(null);
  // What the user picked; until then the dialog offers the position he plays best and ten points of ability more.
  const [pickedPosition, setPickedPosition] = useState<string | null>(null);
  const [typedTarget, setTypedTarget] = useState<string | null>(null);
  const [makeNatural, setMakeNatural] = useState(true);
  const [applying, setApplying] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  useModal(dialog, !applying, onClose);

  useEffect(() => {
    alive.current = true;
    Promise.all([editFields("player"), readValues("player", uid)])
      .then(([list, read]) => {
        if (alive.current) {
          setFields(new Map(list.map((field) => [field.key, field])));
          setValues(read);
        }
      })
      .catch((e) => {
        if (alive.current) {
          setFailure(describeError(e));
        }
      });
    return () => {
      alive.current = false;
    };
  }, [uid]);

  const loaded = fields !== null && values !== null;
  const abilityNow = loaded ? (values["current_ability"] ?? null) : null;

  let bestPosition = "st";
  if (loaded) {
    let bestRating = 0;
    for (const position of POSITIONS) {
      const rating = ratingAt(fields, values, position.key) ?? 0;
      if (rating > bestRating) {
        bestRating = rating;
        bestPosition = position.key;
      }
    }
  }
  const positionKey = pickedPosition ?? bestPosition;
  const position = POSITIONS.find((choice) => choice.key === positionKey) ?? POSITIONS[POSITIONS.length - 1];

  const targetText = typedTarget ?? (abilityNow === null ? "" : String(Math.min(200, abilityNow + 10)));
  const target = Number(targetText);
  const targetValid = Number.isInteger(target) && target >= 1 && target <= 200;

  const plan = loaded && targetValid ? planFor(fields, values, position, target, makeNatural) : null;
  const nothingToDo = plan !== null && plan.edits.length === 0;

  const apply = async () => {
    if (running.current || plan === null || plan.edits.length === 0) {
      return;
    }
    running.current = true;
    setApplying(true);
    setFailure(null);
    setProblems([]);
    try {
      const report = await applyEdits("player", uid, plan.edits);
      onEdited();
      if (report.failed.length === 0) {
        onClose();
        return;
      }
      // Some were refused: the dialog stays, says which, and reads him again so that it shows what is left.
      const read = await readValues("player", uid);
      if (alive.current) {
        setValues(read);
        setProblems(report.failed.map((failed) => `${fieldLabel("player", failed.field)}: ${describeError(failed.error)}`));
      }
    } catch (e) {
      if (alive.current) {
        setFailure(describeError(e));
      }
    } finally {
      running.current = false;
      if (alive.current) {
        setApplying(false);
      }
    }
  };

  return createPortal(
    // A click beside the dialog does nothing, and keeps focus where it is.
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
        }
      }}
    >
      <div
        ref={dialog}
        className="modal move-dialog upgrade-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id("title")}
        aria-describedby={id("player")}
        aria-busy={applying || undefined}
        tabIndex={-1}
      >
        <header className="modal-head">
          <h2 id={id("title")}>Upgrade for a position</h2>
          <p id={id("player")} className="move-player">
            {name}
          </p>
        </header>

        <div className="modal-body">
          <section className="move-section" aria-labelledby={id("what")}>
            <h3 id={id("what")}>Position and level</h3>
            <div className="upgrade-inputs">
              <label>
                <span>Position</span>
                <select className="edit-input" value={positionKey} disabled={applying} onChange={(e) => setPickedPosition(e.currentTarget.value)}>
                  {POSITIONS.map((choice) => (
                    <option key={choice.key} value={choice.key}>
                      {choice.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Current ability to reach (1–200)</span>
                <input
                  className="edit-input"
                  type="number"
                  min={1}
                  max={200}
                  value={targetText}
                  disabled={applying}
                  onChange={(e) => setTypedTarget(e.currentTarget.value)}
                />
              </label>
              <label className="upgrade-check">
                <input
                  type="checkbox"
                  checked={makeNatural}
                  disabled={applying}
                  onChange={(e) => setMakeNatural(e.currentTarget.checked)}
                />
                <span>Also make him natural in this position</span>
              </label>
            </div>
          </section>

          <section className="move-section" aria-labelledby={id("changes")}>
            <h3 id={id("changes")}>What changes</h3>
            {!loaded && failure === null && <p className="note">Reading the player…</p>}
            {loaded && !targetValid && <p className="note">Type an ability from 1 to 200.</p>}
            {loaded && targetValid && plan === null && (
              <p className="note">His ability or attributes cannot be read now, so there is nothing to work out.</p>
            )}
            {nothingToDo && <p className="note">He is at this level in this position already: nothing to change.</p>}
            {plan !== null && !nothingToDo && (
              <>
                <ul className="upgrade-facts">
                  <li>
                    <span>Current ability</span>
                    <span className="upgrade-change">
                      {plan.ability.before} → <strong>{plan.ability.after}</strong>
                    </span>
                  </li>
                  {plan.potential !== null && (
                    <li>
                      <span>Potential ability</span>
                      <span className="upgrade-change">
                        {plan.potential.before} → <strong>{plan.potential.after}</strong>
                      </span>
                    </li>
                  )}
                  {plan.rating !== null && (
                    <li>
                      <span>Rating as {position.name.toLowerCase()}</span>
                      <span className="upgrade-change">
                        {plan.rating.before} → <strong>{plan.rating.after}</strong>
                      </span>
                    </li>
                  )}
                </ul>
                {plan.rows.length > 0 && (
                  <ul className="upgrade-rows">
                    {plan.rows.map((row) => (
                      <li key={row.key}>
                        <span>{fieldLabel("player", row.key)}</span>
                        <span className="upgrade-change">
                          <span className={`value tier-${tier(row.before)}`}>{row.before}</span>
                          <span aria-hidden="true">→</span>
                          <span className="sr-only">to</span>
                          <span className={`value tier-${tier(row.after)}`}>{row.after}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {plan.rows.length === 0 && (
                  <p className="note">His attributes are at this level already; only the lines above change.</p>
                )}
                {!plan.reached && (
                  <p className="note">
                    Every attribute that counts for this position would be at 20, and that is still short of this level.
                  </p>
                )}
              </>
            )}
            <p className="note">
              Which attributes count for a position, and how high they stand at an ability, are this editor's estimates:
              the game does not publish its own. The game may still shift attributes a little over time.
            </p>
          </section>
        </div>

        {failure !== null && (
          <div className="banner move-error" role="alert">
            {failure}
          </div>
        )}
        {problems.length > 0 && (
          <div className="banner move-error" role="alert">
            <p>The rest was written. These were refused:</p>
            <ul>
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}

        <footer className="modal-foot">
          <span className="move-foot-note">Undo is in the Changes view, one line per change.</span>
          <button
            type="button"
            className="primary"
            disabled={applying || plan === null || nothingToDo}
            onClick={() => void apply()}
          >
            {applying ? "Applying…" : plan !== null && !nothingToDo ? `Apply ${plan.edits.length} changes` : "Apply"}
          </button>
          <button type="button" disabled={applying} onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
