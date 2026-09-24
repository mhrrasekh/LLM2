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


test("ProjectManager lists directories and blocks protected files and symlink escapes", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "llm2-secure-"));
  const filePath = path.join(root, "projects.json");
  await fs.mkdir(path.join(root, "src"));
  await fs.writeFile(path.join(root, "src", "app.js"), "export default 1;\n", "utf8");
  await fs.writeFile(path.join(root, ".env"), "SECRET=value\n", "utf8");

  const manager = new ProjectManager({ filePath });
  await manager.add({ name: "Secure Demo", root });

  const listing = await manager.listFiles("secure-demo");
  assert.equal(listing.items.some(item => item.path === "src" && item.type === "directory"), true);
  assert.equal(listing.items.some(item => item.path === ".env"), true);

  await assert.rejects(
    manager.readFile("secure-demo", ".env"),
    error => error.code === "PROTECTED_FILE"
  );

  if (process.platform !== "win32") {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "llm2-outside-"));
    await fs.writeFile(path.join(outside, "secret.txt"), "outside", "utf8");
    await fs.symlink(outside, path.join(root, "link"));
    await assert.rejects(
      manager.readFile("secure-demo", "link/secret.txt"),
      error => error.code === "PROJECT_PATH_FORBIDDEN"
    );
    await fs.rm(outside, { recursive: true, force: true });
  }

  await fs.rm(root, { recursive: true, force: true });
});
