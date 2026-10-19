// -----------------------------------------------------------------------------
// From the raw Vikunja answers to what Gladys shows: projects, open tasks with
// their due time and reminders in milliseconds, and the counters of a local
// day (the time zone of Gladys, injected by the supervisor as TZ).
//
// Definitions, the same in the devices, the widget, the scene action and the
// documentation:
//   - open: a task not done (with or without a due date);
//   - overdue: an open task whose due time has passed;
//   - to do today: an open task due before the end of the local day,
//     overdue ones included ("what is left to do by tonight");
//   - next task: the open task with the earliest due time still ahead.
// -----------------------------------------------------------------------------

/** Vikunja writes "no date" as year 1 (`0001-01-01T00:00:00Z`). */
const time = (value) => {
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
};

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Real projects only: saved filters and "Favorites" come as pseudo-projects
 * with an id below 1; archived ones are left out.
 * @param {unknown[]} raw answer of GET /api/v1/projects
 * @returns {Array<{ id: number, title: string, parentId: number, position: number }>}
 */
export function parseProjects(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((project) => project && Number.isInteger(project.id) && project.id > 0)
    .filter((project) => project.is_archived !== true)
    .map((project) => ({
      id: project.id,
      title: text(project.title) || `#${project.id}`,
      parentId: Number.isInteger(project.parent_project_id) ? project.parent_project_id : 0,
      position: Number.isFinite(project.position) ? project.position : 0,
    }))
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

/**
 * Open tasks, sorted by due time (undated last), then id.
 * @param {unknown[]} raw answer of GET /api/v1/tasks
 * @returns {Array<{ id: number, title: string, projectId: number, dueAt: number|null,
 *   priority: number, reminders: number[], repeats: boolean }>}
 */
export function parseTasks(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((task) => task && Number.isInteger(task.id) && task.done !== true)
    .map((task) => ({
      id: task.id,
      title: text(task.title) || `#${task.id}`,
      projectId: Number.isInteger(task.project_id) ? task.project_id : 0,
      dueAt: time(task.due_date),
      priority: Number.isInteger(task.priority) ? task.priority : 0,
      reminders: (Array.isArray(task.reminders) ? task.reminders : [])
        .map((reminder) => time(reminder?.reminder))
        .filter((ms) => ms !== null)
        .sort((a, b) => a - b),
      repeats: (Number(task.repeat_after) || 0) > 0 || (Number(task.repeat_mode) || 0) > 0,
    }))
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || a.id - b.id);
}

// --- Local days -------------------------------------------------------------------

const partsFormatters = new Map();

function zonedParts(ms, timeZone) {
  let format = partsFormatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    partsFormatters.set(timeZone, format);
  }
  const parts = Object.fromEntries(
    format.formatToParts(new Date(ms)).map(({ type, value }) => [type, Number(value)]),
  );
  return parts;
}

/** Offset of `timeZone` from UTC at `ms`, in milliseconds. */
function offsetAt(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** UTC instant of local midnight of a local calendar day (DST-safe). */
function localMidnight(year, month, day, timeZone) {
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - offsetAt(guess, timeZone);
  let start = guess - offsetAt(first, timeZone);
  // Where the clocks jump at midnight (Chile, Cuba), 00:00 does not exist and
  // the instant found is 23:00 the day before: the day starts an hour later.
  if (zonedParts(start, timeZone).day !== day) {
    start += 60 * 60_000;
  }
  return start;
}

/** A time zone Intl knows, else the one of the process. */
export function resolveTimeZone(timeZone) {
  try {
    if (timeZone) {
      new Intl.DateTimeFormat('en-US', { timeZone });
      return timeZone;
    }
  } catch {
    // fall through
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Start and end (exclusive) of the local day holding `now`. */
export function localDay(now, timeZone) {
  const p = zonedParts(now, timeZone);
  const start = localMidnight(p.year, p.month, p.day, timeZone);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const end = localMidnight(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    timeZone,
  );
  return { start, end };
}

// --- Counters ---------------------------------------------------------------------

/**
 * Counters of one day, for every followed project (`projectId` null) or one.
 * @param {ReturnType<typeof parseTasks>} tasks
 * @param {{ now: number, day: { start: number, end: number }, projectId?: number|null }} options
 */
export function summarize(tasks, { now, day, projectId = null }) {
  const mine = projectId === null ? tasks : tasks.filter((task) => task.projectId === projectId);
  const dated = mine.filter((task) => task.dueAt !== null);
  const today = dated.filter((task) => task.dueAt < day.end);
  return {
    open: mine.length,
    toDoToday: today.length,
    overdue: dated.filter((task) => task.dueAt < now).length,
    next: dated.find((task) => task.dueAt >= now) ?? null,
    today,
  };
}

const fold = (value) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Find an item by its number (`12`, `#12`) or its exact title (case, accents
 * and repeated blanks ignored).
 * @template {{ id: number, title: string }} T
 * @param {T[]} items
 * @param {unknown} query
 * @returns {{ item: T|null, reason?: 'empty'|'not_found'|'ambiguous' }}
 */
export function findByIdOrTitle(items, query) {
  const wanted = typeof query === 'number' ? String(query) : String(query ?? '').trim();
  if (!wanted) {
    return { item: null, reason: 'empty' };
  }
  const number = wanted.match(/^#?(\d+)$/);
  if (number) {
    const byId = items.find((item) => item.id === Number(number[1]));
    if (byId) {
      return { item: byId };
    }
  }
  const matches = items.filter((item) => fold(item.title) === fold(wanted));
  if (matches.length === 1) {
    return { item: matches[0] };
  }
  return { item: null, reason: matches.length > 1 ? 'ambiguous' : 'not_found' };
}
