// -----------------------------------------------------------------------------
// An in-memory Vikunja, answering the routes the integration calls the way
// the real server does (status codes and `{ code, message }` errors, 401 for
// a permission the token lacks, pagination headers, an update that REPLACES
// the task, repeating tasks moved forward when done, the web app's HTML page
// outside /api). Its starting data are real answers of vikunja/vikunja
// v2.7.0 in Docker (October 2026, test/fixtures/vikunja/real-*.json): four
// projects (one a sub-project) and eight open tasks — two overdue, two due
// tonight, four later or undated — plus a saved filter, which is no project.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/vikunja/${name}.json`, import.meta.url), 'utf8'));

export const TOKEN = 'tk_0123456789abcdef0123456789abcdef01234567';
export const PERMISSIONS = Object.freeze({
  projects: ['read_all'],
  tasks: ['read_all', 'read_one', 'update', 'create'],
});

const NO_DATE = '0001-01-01T00:00:00Z';
const json = (status, value, headers = {}) => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  body: JSON.stringify(value),
});
const unauthorized = () =>
  json(401, {
    code: 11,
    message: 'missing, malformed, expired or otherwise invalid token provided',
  });

function paginate(items, search) {
  const perPage = Math.min(50, Number(search.get('per_page')) || 50);
  const page = Math.max(1, Number(search.get('page')) || 1);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  return json(200, items.slice((page - 1) * perPage, page * perPage), {
    'x-pagination-total-pages': String(pages),
    'x-pagination-result-count': String(Math.min(perPage, items.length)),
  });
}

export class FakeVikunja {
  constructor({ now = () => Date.now(), token = TOKEN, permissions = PERMISSIONS } = {}) {
    this.now = now;
    this.token = token;
    this.permissions = structuredClone(permissions);
    this.version = 'v2.7.0';
    this.projects = structuredClone(fixture('real-projects'));
    this.tasks = structuredClone(fixture('real-tasks-open'));
    this.online = true;
    /** Before Vikunja 1.0, the task list was /tasks/all. */
    this.legacyTaskList = false;
    this.requests = [];
    this.nextId = 100;
  }

  task(id) {
    return this.tasks.find((task) => task.id === id);
  }

  /** Mark a task done the way Vikunja does (a repeating one moves forward). */
  markDone(task) {
    if (task.repeat_after > 0 && task.due_date !== NO_DATE) {
      const step = task.repeat_after * 1000;
      const shift = (value) =>
        value && value !== NO_DATE ? new Date(Date.parse(value) + step).toISOString() : value;
      task.due_date = shift(task.due_date);
      task.reminders = task.reminders?.map((r) => ({ ...r, reminder: shift(r.reminder) })) ?? null;
      task.done = false;
    } else {
      task.done = true;
      task.done_at = new Date(this.now()).toISOString();
    }
  }

  allowed(group, permission) {
    return this.permissions[group]?.includes(permission) ?? false;
  }

  handle(url, { method = 'GET', headers = {}, json: body } = {}) {
    const { pathname, searchParams } = new URL(url);
    this.requests.push({ method, path: pathname, search: searchParams.toString() });
    if (!pathname.startsWith('/api/')) {
      return { status: 200, headers: { 'content-type': 'text/html' }, body: '<!DOCTYPE html>' };
    }
    if (method === 'GET' && pathname === '/api/v1/info') {
      return json(200, { version: this.version, max_items_per_page: 50 });
    }
    const authorized = headers.authorization === `Bearer ${this.token}`;
    const taskId = pathname.match(/^\/api\/v1\/tasks\/(\d+)$/);
    const projectTasks = pathname.match(/^\/api\/v1\/projects\/(\d+)\/tasks$/);
    const taskList = this.legacyTaskList ? '/api/v1/tasks/all' : '/api/v1/tasks';

    if (method === 'GET' && pathname === '/api/v1/projects') {
      if (!authorized || !this.allowed('projects', 'read_all')) {
        return unauthorized();
      }
      return paginate(
        this.projects.filter((project) => !project.is_archived),
        searchParams,
      );
    }
    if (method === 'GET' && pathname === taskList) {
      if (!authorized || !this.allowed('tasks', 'read_all')) {
        return unauthorized();
      }
      const open = searchParams.get('filter') === 'done = false';
      return paginate(
        this.tasks.filter((task) => !open || !task.done),
        searchParams,
      );
    }
    if (taskId && (method === 'GET' || method === 'POST')) {
      const permission = method === 'GET' ? 'read_one' : 'update';
      if (!authorized || !this.allowed('tasks', permission)) {
        return unauthorized();
      }
      const task = this.task(Number(taskId[1]));
      if (!task) {
        return json(404, { code: 4002, message: 'This task does not exist' });
      }
      if (method === 'GET') {
        return json(200, task);
      }
      // An update replaces every field: what the body leaves out is reset.
      const done = body?.done === true && !task.done;
      Object.assign(task, {
        title: body?.title ?? '',
        due_date: body?.due_date ?? NO_DATE,
        priority: body?.priority ?? 0,
        reminders: body?.reminders ?? null,
        repeat_after: body?.repeat_after ?? 0,
        done: body?.done === true,
      });
      if (done) {
        task.done = false;
        this.markDone(task);
      }
      return json(200, task);
    }
    if (projectTasks && method === 'PUT') {
      if (!authorized || !this.allowed('tasks', 'create')) {
        return unauthorized();
      }
      const projectId = Number(projectTasks[1]);
      if (!this.projects.some((project) => project.id === projectId && projectId > 0)) {
        return json(404, { code: 3001, message: 'This project does not exist.' });
      }
      if (!body?.title) {
        return json(400, { code: 4001, message: 'You must provide at least a task title.' });
      }
      const task = {
        id: this.nextId++,
        title: body.title,
        project_id: projectId,
        done: false,
        due_date: body.due_date ?? NO_DATE,
        reminders: null,
        repeat_after: 0,
        priority: body.priority ?? 0,
      };
      this.tasks.push(task);
      return json(201, task);
    }
    if (pathname === '/api/v1/tasks/all') {
      // Vikunja 1.0+ reads "all" as a task id.
      return json(400, { code: 2002, message: 'Invalid model' });
    }
    return json(404, { message: 'Not Found' });
  }
}

/** The network: one fake server per base URL; anything else does not answer. */
export function createNetwork(servers) {
  return {
    servers,
    async request(url, options = {}) {
      const base = Object.keys(servers).find((origin) => url.startsWith(`${origin}/`));
      const server = base ? servers[base] : null;
      if (!server || !server.online) {
        const error = new Error('connect ECONNREFUSED');
        error.code = 'ECONNREFUSED';
        throw error;
      }
      return server.handle(url, options);
    },
  };
}
