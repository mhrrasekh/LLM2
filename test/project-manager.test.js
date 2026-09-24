import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProjectManager } from "../src/project-manager.js";

test("ProjectManager registers a workspace and protects paths", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "llm2-project-"));
  const filePath = path.join(root, "projects.json");
  await fs.writeFile(path.join(root, "hello.txt"), "hello LLM2\n", "utf8");

  const manager = new ProjectManager({ filePath, maxFileBytes: 10000 });
  const project = await manager.add({ name: "Demo", root });

  assert.equal(project.id, "demo");
  assert.equal((await manager.list()).length, 1);
  assert.equal((await manager.readFile("demo", "hello.txt")).content, "hello LLM2\n");
  await assert.rejects(
    manager.readFile("demo", "../outside.txt"),
    error => error.code === "PROJECT_PATH_FORBIDDEN"
  );

  await fs.rm(root, { recursive: true, force: true });
});

test("ProjectManager searches and reads configured project files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "llm2-search-"));
  const filePath = path.join(root, "projects.json");
  await fs.writeFile(path.join(root, "app.js"), "const answer = 42;\n", "utf8");

  const manager = new ProjectManager({ filePath });
  await manager.add({ name: "Search Demo", root });
  const result = await manager.search("search-demo", "answer");

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].path, "app.js");

  await fs.rm(root, { recursive: true, force: true });
});
