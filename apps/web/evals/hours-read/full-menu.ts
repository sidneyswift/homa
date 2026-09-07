import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { gateway } from "ai";
import ts from "typescript";
import { z } from "zod";

import { handwritingRowsSchema } from "../../lib/materials/handwriting/document";
import { familySourceEvidenceProposalSchema, MAX_FAMILY_SOURCE_EVIDENCE } from "../../lib/library/family-asset-source-evidence-contract";

interface MenuTool { name: string; description: string; inputSchema: Record<string, unknown>; logicalPath?: string }
const require = createRequire(import.meta.url);

/** Exact authored compiled schemas plus installed Eve framework schemas.
 * Dynamic web tools are lowered from only their source schema expressions:
 * no tool module, database, upload, provider, or effect body is evaluated.
 * The fixed neutral web context is outside onboarding and Progress jobs. */
export async function fullHoursEvalMenu(webRoot: string): Promise<MenuTool[]> {
  const manifest = JSON.parse(await readFile(resolve(webRoot, ".eve/compile/compiled-agent-manifest.json"), "utf8")) as { tools: MenuTool[]; disabledFrameworkTools: string[] };
  const { getFrameworkToolDefinitions } = require(resolve(dirname(require.resolve("eve")), "runtime/framework-tools/index.js")) as { getFrameworkToolDefinitions: (input: { hasConnections: boolean }) => MenuTool[] };
  const authored = new Set(manifest.tools.map(t => t.name));
  const framework = getFrameworkToolDefinitions({ hasConnections: false }).filter(t => !authored.has(t.name) && !manifest.disabledFrameworkTools.includes(t.name));
  const menu = [...framework, ...manifest.tools].map(({ name, description, inputSchema, logicalPath }) => ({ name, description, inputSchema, logicalPath }));
  // Eve resolves Gateway web_search as a provider-managed Parallel tool.
  // Preserve its actual input schema but use a local refusal stub in this
  // harness, so a routing mistake cannot start an external search.
  const search = menu.find(item => item.name === "web_search");
  if (search && search.inputSchema === null) {
    const schemaFactory = gateway.tools.parallelSearch().inputSchema;
    if (typeof schemaFactory !== "function") throw new Error("Eve Gateway search schema contract changed.");
    const resolved: unknown = await schemaFactory();
    if (!resolved || typeof resolved !== "object" || !("jsonSchema" in resolved)) throw new Error("Gateway search input schema missing.");
    search.inputSchema = await (resolved.jsonSchema as Record<string, unknown> | Promise<Record<string, unknown>>);
  }
  const declarations: string[] = [];
  const add = async (path: string, names: string[]) => {
    const source = await readFile(resolve(webRoot, path), "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    for (const name of names) {
      let text: string | undefined;
      for (const statement of ast.statements) {
        if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
          if (declaration.name.getText(ast) === name && declaration.initializer) text = `const ${name} = ${declaration.initializer.getText(ast)};`;
        }
        if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) text = statement.getText(ast).replace(/^export /, "");
      }
      if (!text) throw new Error(`Missing reviewed schema declaration ${path}:${name}`);
      declarations.push(text);
    }
  };
  await add("lib/materials/kinds.ts", ["MATERIAL_KINDS"]);
  await add("lib/materials/recipes.generated.ts", ["RECIPE_SLUGS"]);
  await add("lib/library/family-asset-reference.ts", ["MAX_FAMILY_ASSET_REFERENCES"]);
  await add("lib/materials/generate-image.ts", ["SHAPE_SIZE", "IMAGE_SHAPES"]);
  await add("lib/materials/anchors.ts", ["JPEG", "REGISTRY", "listStudioAnchors", "studioAnchorIds"]);
  await add("agent/tools/generate_image.ts", ["ANCHOR_IDS", "ANCHOR_ID_ENUM", "ANCHOR_MENU"]);
  await add("agent/tools/create_printable.ts", ["MAX_PACKET_PAGES", "packetPageInput", "createPrintableInputSchema"]);
  await add("agent/tools/ask_user_questions.ts", ["optionSchema", "questionSchema"]);
  for (const name of ["ask_for_details", "ask_user_questions", "create_printable", "generate_image", "start_checklist"]) {
    const source = await readFile(resolve(webRoot, `agent/tools/${name}.ts`), "utf8");
    const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    let body: ts.ObjectLiteralExpression | undefined;
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === "defineBoundedTool" && ts.isObjectLiteralExpression(node.arguments[0]!)) body = node.arguments[0] as ts.ObjectLiteralExpression;
      ts.forEachChild(node, visit);
    };
    visit(ast);
    if (!body) throw new Error(`No bounded definition for ${name}`);
    const field = (key: string) => {
      const value = body!.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === key) as ts.PropertyAssignment | undefined;
      if (!value) throw new Error(`No ${key} for ${name}`);
      return value.initializer.getText(ast);
    };
    const capture: { description?: string; schema?: z.ZodType } = {};
    const expression = `${declarations.join("\n")}\ncapture.description = ${field("description")}; capture.schema = ${field("inputSchema")};`;
    runInNewContext(ts.transpileModule(expression, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { z, capture, familySourceEvidenceProposalSchema, MAX_FAMILY_SOURCE_EVIDENCE, handwritingRowsSchema }, { timeout: 1000 });
    if (!capture.description || !capture.schema) throw new Error(`Incomplete menu tool ${name}`);
    menu.push({ name, description: capture.description, inputSchema: z.toJSONSchema(capture.schema), logicalPath: `tools/${name}.ts` });
  }
  if (new Set(menu.map(t => t.name)).size !== menu.length) throw new Error("Duplicate menu tool names.");
  return menu;
}
