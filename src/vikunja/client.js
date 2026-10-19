// -----------------------------------------------------------------------------
// Vikunja API client: the calls the integration needs, on `/api/v1`,
// authenticated by an API token (`tk_…`, Settings → API tokens, Vikunja
// 0.22+) in the `Authorization: Bearer` header. Checked against a real
// vikunja/vikunja v2.7.0 in Docker, October 2026.
//
//   GET  /api/v1/info                               version (no token needed)
//   GET  /api/v1/projects                           Project[] (archived left out)
//   GET  /api/v1/tasks?filter=done = false&page=N   Task[], paginated
//   GET  /api/v1/tasks/:id                          Task
//   POST /api/v1/tasks/:id                          Task (update)
//   PUT  /api/v1/projects/:id/tasks                 Task (create)
//
// Pitfalls found on the real server:
//   - POST /tasks/:id REPLACES the task: a body `{ "done": true }` also wipes
//     its due date, priority, reminders… The task is read first and sent back
//     whole, with `done: true`.
//   - A repeating task marked done comes back `done: false`, its due date
//     moved by the interval: that is how Vikunja repeats.
//   - Pages hold at most `max_items_per_page` (50 by default) tasks; the
//     number of pages is in the `x-pagination-total-pages` header.
//   - A token without the permission a route needs gets the same 401 as a
//     wrong token (code 11).
//   - Before Vikunja 1.0 the task list was `/tasks/all`; since, `/tasks/all`
//     is read as the task "all" (400). `/tasks` is tried first.
// -----------------------------------------------------------------------------

import { httpRequest } from './http.js';

export const ERROR_KINDS = Object.freeze({
  UNREACHABLE: 'unreachable', // no answer: down, wrong address, firewall
  TLS: 'tls', // the certificate does not verify (self-signed without the option)
  AUTH: 'auth', // missing, wrong, expired token, or a permission it lacks
  NOT_VIKUNJA: 'not_vikunja', // something answers, but not the Vikunja API
  REDIRECT: 'redirect', // HTTP redirected to HTTPS, or a login portal
  RATE_LIMIT: 'rate_limit', // 429: the server's request limit
  HTTP: 'http', // any other unexpected answer
});

export class VikunjaError extends Error {
  constructor(kind, message, status, code) {
    super(message);
    this.name = 'VikunjaError';
    this.kind = kind;
    this.status = status;
    /** Vikunja's own error code (`code` of the JSON answer), e.g. 4002. */
    this.code = code;
  }
}

const TLS_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

// Vikunja error codes the integration tells apart.
export const VIKUNJA_CODES = Object.freeze({
  PROJECT_NOT_FOUND: 3001,
  TASK_TITLE_EMPTY: 4001,
  TASK_NOT_FOUND: 4002,
});

const PAGE_SIZE = 50;
const MAX_PAGES = 20;

function networkError(err) {
  if (TLS_CODES.has(err.code)) {
    return new VikunjaError(ERROR_KINDS.TLS, `Certificate refused (${err.code})`);
  }
  return new VikunjaError(ERROR_KINDS.UNREACHABLE, err.code ? `${err.code}` : err.message);
}

export class VikunjaClient {
  /**
   * @param {object} options
   * @param {string} options.url base URL, without trailing slash
   * @param {string} options.token API token (Settings → API tokens)
   * @param {boolean} [options.insecure] accept a self-signed certificate
   * @param {Function} [options.request] HTTP seam (src/vikunja/http.js)
   */
  constructor({ url, token, insecure = false, request = httpRequest }) {
    this.url = url;
    this.token = token;
    this.insecure = insecure;
    this.request = request;
    /** `/tasks` (Vikunja 1.0+) or `/tasks/all` (older), found on first use. */
    this.tasksPath = null;
  }

  async call(path, { method = 'GET', json, auth = true } = {}) {
    let response;
    try {
      response = await this.request(`${this.url}/api/v1${path}`, {
        method,
        json,
        insecure: this.insecure,
        headers: auth ? { authorization: `Bearer ${this.token}` } : {},
      });
    } catch (err) {
      throw networkError(err);
    }
    const { status, body, headers = {} } = response;
    let parsed;
    let parsedOk = true;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsedOk = false;
    }
    // The server's own message, short; it never echoes the token.
    const said =
      parsedOk && typeof parsed?.message === 'string' ? ` ${parsed.message.slice(0, 200)}` : '';
    const code = parsedOk && Number.isInteger(parsed?.code) ? parsed.code : undefined;
    if (status === 401 || status === 403) {
      throw new VikunjaError(ERROR_KINDS.AUTH, `HTTP ${status}${said}`, status, code);
    }
    if (status === 429) {
      throw new VikunjaError(ERROR_KINDS.RATE_LIMIT, 'HTTP 429', status);
    }
    if (status >= 300 && status < 400) {
      throw new VikunjaError(ERROR_KINDS.REDIRECT, `HTTP ${status}`, status);
    }
    if (!parsedOk) {
      // The web app answers its HTML page on paths outside the API.
      throw new VikunjaError(
        status === 200 || status === 404 ? ERROR_KINDS.NOT_VIKUNJA : ERROR_KINDS.HTTP,
        `HTTP ${status}, not JSON`,
        status,
      );
    }
    if (status < 200 || status >= 300) {
      throw new VikunjaError(ERROR_KINDS.HTTP, `HTTP ${status}${said}`, status, code);
    }
    return { data: parsed, headers };
  }

  /** `{ version }`; throws NOT_VIKUNJA when the answer is not Vikunja's. */
  async info() {
    let data;
    try {
      ({ data } = await this.call('/info', { auth: false }));
    } catch (err) {
      // Another JSON API, or a Vikunja path prefix missing from the address.
      if (err instanceof VikunjaError && err.status === 404) {
        throw new VikunjaError(ERROR_KINDS.NOT_VIKUNJA, 'no /api/v1/info', 404);
      }
      throw err;
    }
    if (!data || typeof data !== 'object' || typeof data.version !== 'string') {
      throw new VikunjaError(ERROR_KINDS.NOT_VIKUNJA, 'no version in /info', 200);
    }
    return data;
  }

  /** Every page of a list route, `query` included. */
  async all(path, query) {
    const page = (n) =>
      this.call(
        `${path}?${new URLSearchParams({ ...query, per_page: String(PAGE_SIZE), page: String(n) })}`,
      );
    const first = await page(1);
    const items = Array.isArray(first.data) ? [...first.data] : [];
    const pages = Math.min(
      MAX_PAGES,
      Number.parseInt(first.headers['x-pagination-total-pages'], 10) || 1,
    );
    for (let n = 2; n <= pages; n += 1) {
      const { data } = await page(n);
      if (!Array.isArray(data) || data.length === 0) {
        break;
      }
      items.push(...data);
    }
    // Offset pages are not stable: an item created meanwhile may come twice.
    const seen = new Set();
    return items.filter((item) => {
      if (item && Number.isInteger(item.id)) {
        if (seen.has(item.id)) {
          return false;
        }
        seen.add(item.id);
      }
      return true;
    });
  }

  async projects() {
    return this.all('/projects', {});
  }

  /** Every open task of the projects the token sees (archived ones left out). */
  async openTasks() {
    const query = { filter: 'done = false', sort_by: 'due_date', order_by: 'asc' };
    if (this.tasksPath) {
      return this.all(this.tasksPath, query);
    }
    try {
      const tasks = await this.all('/tasks', query);
      this.tasksPath = '/tasks';
      return tasks;
    } catch (err) {
      if (!(err instanceof VikunjaError) || ![404, 405].includes(err.status)) {
        throw err;
      }
    }
    const tasks = await this.all('/tasks/all', query);
    this.tasksPath = '/tasks/all';
    return tasks;
  }

  async task(id) {
    const { data } = await this.call(`/tasks/${encodeURIComponent(id)}`);
    return data;
  }

  /**
   * Mark a task done, as the token's user. The whole task is sent back (an
   * update replaces every field).
   * @param {number} id
   * @param {object} [options]
   * @param {number} [options.expectedDue] refuse when the due time is no longer this one
   * @returns {Promise<object>} the task as Vikunja saved it
   */
  async complete(id, { expectedDue } = {}) {
    const task = await this.task(id);
    // Checked on the task about to be sent back: a second tap that started
    // before the first one landed must not complete the next occurrence.
    if (expectedDue !== undefined && Date.parse(task?.due_date) !== expectedDue) {
      throw new VikunjaError(ERROR_KINDS.HTTP, 'due date changed', 409, 'stale');
    }
    const { data } = await this.call(`/tasks/${encodeURIComponent(id)}`, {
      method: 'POST',
      json: { ...task, done: true },
    });
    return data;
  }

  /** Create a task in a project. */
  async createTask(projectId, title) {
    const { data } = await this.call(`/projects/${encodeURIComponent(projectId)}/tasks`, {
      method: 'PUT',
      json: { title },
    });
    return data;
  }
}
