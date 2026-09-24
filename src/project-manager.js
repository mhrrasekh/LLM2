import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_IGNORES = new Set([".git", "node_modules", ".next", "dist", "build", "target", "coverage"]);

export class ProjectManager {
  constructor({ filePath = "./data/projects.json", maxProjects = 50, maxFileBytes = 2_000_000, maxSearchResults = 100 } = {}) {
    this.filePath = path.resolve(filePath);
    this.maxProjects = maxProjects;
    this.maxFileBytes = maxFileBytes;
    this.maxSearchResults = maxSearchResults;
    this.projects = new Map();
    this.ready = this.load();
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item?.id && item?.root) this.projects.set(item.id, normalizeProject(item));
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  async persist() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify([...this.projects.values()], null, 2) + "\n", "utf8");
  }

  async list() {
    await this.ready;
    return [...this.projects.values()].map(project => ({ ...project }));
  }

  async get(id) {
    await this.ready;
    return this.projects.get(id) || null;
  }

  async add(input) {
    await this.ready;
    const name = cleanName(input?.name);
    const root = path.resolve(String(input?.root || ""));
    if (!name || !root) throw projectError("INVALID_PROJECT", "Project name and root are required.", 400);
    if (!(await isDirectory(root))) throw projectError("PROJECT_ROOT_NOT_FOUND", "Project root does not exist or is not a directory.", 400);
    if (this.projects.size >= this.maxProjects) throw projectError("PROJECT_LIMIT", "Maximum project count reached.", 400);

    const id = cleanId(input?.id || name);
    const project = normalizeProject({
      id,
      name,
      root,
      description: typeof input.description === "string" ? input.description.slice(0, 500) : "",
      testCommand: normalizeCommand(input.testCommand),
      buildCommand: normalizeCommand(input.buildCommand)
    });
    this.projects.set(id, project);
    await this.persist();
    return { ...project };
  }

  async remove(id) {
    await this.ready;
    const removed = this.projects.delete(id);
    if (removed) await this.persist();
    return removed;
  }

  async resolveFile(id, relativePath) {
    const project = await this.get(id);
    if (!project) throw projectError("PROJECT_NOT_FOUND", "Project not found.", 404);
    const relative = String(relativePath || "");
    if (!relative || path.isAbsolute(relative) || relative.includes("\\") && process.platform !== "win32") {
      throw projectError("INVALID_PROJECT_PATH", "A relative project path is required.", 400);
    }
    const root = path.resolve(project.root);
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw projectError("PROJECT_PATH_FORBIDDEN", "Path is outside the project workspace.", 403);
    }
    return { project, root, target, relative: path.relative(root, target) };
  }

  async readFile(id, relativePath) {
    const resolved = await this.resolveFile(id, relativePath);
    const stat = await fs.stat(resolved.target);
    if (!stat.isFile()) throw projectError("NOT_A_FILE", "Project path is not a file.", 400);
    if (stat.size > this.maxFileBytes) throw projectError("FILE_TOO_LARGE", "File exceeds the configured size limit.", 413);
    return {
      project: resolved.project.id,
      path: resolved.relative,
      bytes: stat.size,
      content: await fs.readFile(resolved.target, "utf8")
    };
  }

  async writeFile(id, relativePath, content) {
    const resolved = await this.resolveFile(id, relativePath);
    if (typeof content !== "string") throw projectError("INVALID_CONTENT", "content must be a string.", 400);
    if (Buffer.byteLength(content, "utf8") > this.maxFileBytes) throw projectError("FILE_TOO_LARGE", "File exceeds the configured size limit.", 413);
    await fs.mkdir(path.dirname(resolved.target), { recursive: true });
    await fs.writeFile(resolved.target, content, "utf8");
    return { project: resolved.project.id, path: resolved.relative, bytes: Buffer.byteLength(content, "utf8") };
  }

  async search(id, query) {
    const project = await this.get(id);
    if (!project) throw projectError("PROJECT_NOT_FOUND", "Project not found.", 404);
    const needle = String(query || "").trim();
    if (!needle) throw projectError("INVALID_SEARCH", "query is required.", 400);
    const results = [];
    await walk(project.root, async file => {
      if (results.length >= this.maxSearchResults) return;
      try {
        const stat = await fs.stat(file);
        if (!stat.isFile() || stat.size > this.maxFileBytes) return;
        const text = await fs.readFile(file, "utf8");
        const index = text.toLowerCase().indexOf(needle.toLowerCase());
        if (index >= 0) {
          const line = text.slice(0, index).split("\n").length;
          results.push({ path: path.relative(project.root, file), line, preview: text.slice(Math.max(0, index - 120), Math.min(text.length, index + needle.length + 180)) });
        }
      } catch {}
    });
    return { project: id, query: needle, truncated: results.length >= this.maxSearchResults, results };
  }

  async git(id, args) {
    const project = await this.get(id);
    if (!project) throw projectError("PROJECT_NOT_FOUND", "Project not found.", 404);
    const allowed = {
      status: ["status", "--short"],
      diff: ["diff", "--stat"],
      diffFull: ["diff"],
      log: ["log", "-5", "--oneline"]
    };
    const command = allowed[args] || null;
    if (!command) throw projectError("INVALID_GIT_OPERATION", "Allowed operations: status, diff, diffFull, log.", 400);
    return this.run(project, "git", command);
  }

  async runConfigured(id, kind) {
    const project = await this.get(id);
    if (!project) throw projectError("PROJECT_NOT_FOUND", "Project not found.", 404);
    const command = kind === "test" ? project.testCommand : kind === "build" ? project.buildCommand : null;
    if (!command) throw projectError("COMMAND_NOT_CONFIGURED", `No ${kind} command is configured for this project.`, 400);
    return this.run(project, command[0], command.slice(1));
  }

  async run(project, executable, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, { cwd: project.root, shell: false, windowsHide: true });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", chunk => { stdout += chunk.toString(); });
      child.stderr.on("data", chunk => { stderr += chunk.toString(); });
      child.on("error", reject);
      child.on("close", code => resolve({ project: project.id, command: [executable, ...args], exitCode: code, stdout, stderr }));
    });
  }
}

function normalizeProject(project) {
  return {
    id: cleanId(project.id),
    name: cleanName(project.name),
    root: path.resolve(project.root),
    description: String(project.description || "").slice(0, 500),
    testCommand: normalizeCommand(project.testCommand),
    buildCommand: normalizeCommand(project.buildCommand)
  };
}

function normalizeCommand(command) {
  if (Array.isArray(command) && command.length && command.every(item => typeof item === "string" && item.length < 300)) return command;
  return null;
}

function cleanId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function cleanName(value) {
  return String(value || "").trim().slice(0, 120);
}

async function isDirectory(target) {
  try { return (await fs.stat(target)).isDirectory(); } catch { return false; }
}

async function walk(dir, onFile) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (DEFAULT_IGNORES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, onFile);
    else if (entry.isFile()) await onFile(full);
  }
}

function projectError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
