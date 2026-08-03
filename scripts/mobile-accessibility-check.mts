import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import {
  nativeAccessibilityHandoffs,
  nativeAccessibilityJourneys,
  nativeAccessibilitySurfaces,
  type NativeAccessibilityHandoff,
  type NativeAccessibilityJourney,
  type NativeAccessibilitySurface,
} from "../apps/mobile/src/lib/accessibility/acceptance-manifest";

const REPO_ROOT = process.cwd();
const MOBILE_SOURCE_ROOT = "apps/mobile/src";
const MOBILE_APP_ROOT = "apps/mobile/src/app";
const requireFromMobile = createRequire(resolve(REPO_ROOT, "apps/mobile/package.json"));
// TypeScript is a direct mobile workspace dependency. Loading it from that
// package keeps this guard dependency-neutral at the monorepo root.
const ts = requireFromMobile("typescript");

const BANNED_TEXT_PROPS = new Set([
  "adjustsFontSizeToFit",
  "allowFontScaling",
  "maxFontSizeMultiplier",
]);
const BANNED_ACCESSIBILITY_PROPS = new Set([
  "accessibilityLiveRegion",
  "experimental_accessibilityOrder",
]);
const DIRECT_ANNOUNCEMENT_CALLS = new Set([
  "announceForAccessibility",
  "announceForAccessibilityWithOptions",
]);
const UNSAFE_NORMAL_TEXT_TOKENS = new Set([
  "brand",
  "brandHover",
  "danger",
  "sage",
  "textSubtle",
]);
const KNOWN_HANDOFF_CALLEES = new Set(
  nativeAccessibilityHandoffs.map((handoff) => handoff.callee),
);
const REQUIRED_JOURNEY_STATES = new Set([
  "loading",
  "streaming",
  "success",
  "error",
  "interruption",
  "empty",
  "recovery",
  "system-handoff",
]);
const REQUIRED_EVIDENCE = new Set([
  "static",
  "rendered",
  "simulator",
  "physical-device",
  "study",
]);

export interface AccessibilityViolation {
  code: string;
  file: string;
  line: number;
  detail: string;
}

export interface DiscoveredHandoff {
  file: string;
  callee: string;
  line: number;
}

export interface SourceAccessibilityScan {
  handoffs: DiscoveredHandoff[];
  violations: AccessibilityViolation[];
}

export interface PackageManifest {
  packageManager?: string;
  scripts?: Readonly<Record<string, string>>;
  dependencies?: Readonly<Record<string, string>>;
  devDependencies?: Readonly<Record<string, string>>;
}

const MOBILE_FORBIDDEN_TEST_DEPENDENCIES = [
  "@testing-library/react-native",
  "@types/jest",
  "jest",
  "jest-expo",
  "test-renderer",
] as const;
const ROOT_FORBIDDEN_NATIVE_TEST_DEPENDENCIES = [
  "@react-native/jest-preset",
  "@testing-library/react-native",
  "jest-expo",
  "test-renderer",
] as const;
const REQUIRED_ISOLATED_TEST_DEPENDENCIES = [
  "@testing-library/react-native",
  "@types/jest",
  "@types/react",
  "expo",
  "jest",
  "jest-expo",
  "react",
  "react-native",
  "test-renderer",
  "typescript",
] as const;
const MOBILE_FORBIDDEN_TEST_SCRIPTS = [
  "test:accessibility",
  "typecheck:accessibility-tests",
] as const;

function normalized(path: string): string {
  return path.split(sep).join("/");
}

function repoRelative(path: string): string {
  return normalized(relative(REPO_ROOT, path));
}

function* walkSourceFiles(root: string): Generator<string> {
  for (const entry of readdirSync(root).sort()) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      yield* walkSourceFiles(path);
      continue;
    }
    if (!/\.(ts|tsx)$/u.test(entry)) continue;
    if (/\.(test|spec)\.(ts|tsx)$/u.test(entry)) continue;
    yield path;
  }
}

function moduleNameOf(node: any): string | null {
  if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return null;
  return node.moduleSpecifier.text;
}

function canonicalNamespace(moduleName: string): string | null {
  if (moduleName === "react-native") return "";
  if (moduleName === "expo-calendar") return "Calendar";
  if (moduleName === "expo-web-browser") return "WebBrowser";
  if (moduleName === "expo-apple-authentication") return "AppleAuthentication";
  return null;
}

function propertyParts(node: any): string[] | null {
  if (ts.isIdentifier(node)) return [node.text];
  if (!ts.isPropertyAccessExpression(node)) return null;
  const parent = propertyParts(node.expression);
  return parent ? [...parent, node.name.text] : null;
}

function canonicalCallee(
  expression: any,
  bindingAliases: ReadonlyMap<string, string>,
  namespaceAliases: ReadonlyMap<string, string>,
): string | null {
  const parts = propertyParts(expression);
  if (!parts || parts.length === 0) return null;
  const namespace = namespaceAliases.get(parts[0]);
  if (namespace !== undefined) {
    const rest = parts.slice(1);
    return [namespace, ...rest].filter(Boolean).join(".");
  }
  const importedName = bindingAliases.get(parts[0]);
  if (importedName) parts[0] = importedName;
  return parts.join(".");
}

function jsxName(node: any): string {
  return node.name?.text ?? node.name?.getText?.() ?? "";
}

function lineFor(sourceFile: any, node: any): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/**
 * Scans parsed TypeScript JSX. Tests drive this on adversarial source strings,
 * while the command drives it over every production mobile source file.
 */
export function scanAccessibilitySource(file: string, source: string): SourceAccessibilityScan {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const bindingAliases = new Map<string, string>();
  const namespaceAliases = new Map<string, string>();
  const modalNames = new Set<string>();
  const spinnerNames = new Set<string>();
  const reactNativeNamespaces = new Set<string>();
  const violations: AccessibilityViolation[] = [];
  const handoffs: DiscoveredHandoff[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const moduleName = moduleNameOf(statement);
    const bindings = statement.importClause?.namedBindings;
    if (!moduleName || !bindings) continue;
    if (ts.isNamespaceImport(bindings)) {
      const namespace = canonicalNamespace(moduleName);
      if (namespace !== null) namespaceAliases.set(bindings.name.text, namespace);
      if (moduleName === "react-native") reactNativeNamespaces.add(bindings.name.text);
      continue;
    }
    if (!ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      const local = element.name.text;
      bindingAliases.set(local, imported);
      if (moduleName === "react-native" && imported === "Modal") modalNames.add(local);
      if (moduleName === "react-native" && imported === "ActivityIndicator") spinnerNames.add(local);
    }
  }

  function report(code: string, node: any, detail: string): void {
    violations.push({ code, file, line: lineFor(sourceFile, node), detail });
  }

  function inspectForbiddenProp(name: string, node: any): void {
    if (BANNED_TEXT_PROPS.has(name)) {
      report("text-scale-cap", node, `${name} prevents full system text scaling`);
    }
    if (BANNED_ACCESSIBILITY_PROPS.has(name)) {
      report("bypassed-accessibility-adapter", node, `${name} bypasses the shared accessibility policy`);
    }
  }

  function unsafeTextColorToken(node: any): string | null {
    const parts = propertyParts(node);
    if (
      parts?.length === 2
      && parts[0] === "colors"
      && UNSAFE_NORMAL_TEXT_TOKENS.has(parts[1])
    ) {
      return parts[1];
    }
    let match: string | null = null;
    ts.forEachChild(node, (child: any) => {
      if (!match) match = unsafeTextColorToken(child);
    });
    return match;
  }

  function visit(node: any): void {
    if (
      ts.isPropertyAssignment(node)
      && node.name.getText(sourceFile).replace(/["']/gu, "") === "color"
    ) {
      const token = unsafeTextColorToken(node.initializer);
      if (token) {
        report(
          "unsafe-normal-text-contrast",
          node,
          `colors.${token} is below 4.5 to 1 on at least one production light surface`,
        );
      }
    }
    if (ts.isJsxAttribute(node)) {
      const attributeName = jsxName(node);
      inspectForbiddenProp(attributeName, node);
      if (
        attributeName === "placeholderTextColor"
        && node.initializer
        && ts.isJsxExpression(node.initializer)
        && unsafeTextColorToken(node.initializer.expression)?.includes("textSubtle")
      ) {
        report(
          "unsafe-placeholder-contrast",
          node,
          "Use colors.textMuted or stronger for readable placeholder text",
        );
      }
    }
    if (ts.isJsxSpreadAttribute(node) && ts.isObjectLiteralExpression(node.expression)) {
      for (const property of node.expression.properties) {
        if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
          inspectForbiddenProp(property.name.getText(sourceFile).replace(/["']/gu, ""), property);
        }
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile);
      if (
        tag === "Text"
        && file !== "apps/mobile/src/features/voice/transcript-ribbon.tsx"
        && node.attributes.properties.some(
          (attribute: any) => ts.isJsxAttribute(attribute) && jsxName(attribute) === "numberOfLines",
        )
      ) {
        report(
          "truncated-essential-text",
          node,
          "Remove numberOfLines or provide an explicit adjacent full-text alternative",
        );
      }
      const rawModal = modalNames.has(tag) || [...reactNativeNamespaces].some((name) => tag === `${name}.Modal`);
      const rawSpinner = spinnerNames.has(tag) || [...reactNativeNamespaces].some((name) => tag === `${name}.ActivityIndicator`);
      if (rawModal && file !== "apps/mobile/src/components/ui/accessible-modal.tsx") {
        report("raw-modal", node, "Use AccessibleModal so isolation, escape, naming, and Reduce Motion stay centralized");
      }
      if (rawSpinner && file !== "apps/mobile/src/components/ui/loading-status.tsx") {
        report("raw-spinner", node, "Use LoadingStatus so waiting has a visible and spoken name");
      }
    }

    if (ts.isCallExpression(node)) {
      const callee = canonicalCallee(node.expression, bindingAliases, namespaceAliases);
      const leaf = callee?.split(".").at(-1) ?? null;
      if (
        leaf &&
        DIRECT_ANNOUNCEMENT_CALLS.has(leaf) &&
        file !== "apps/mobile/src/lib/accessibility.ts"
      ) {
        report("direct-announcement", node, "Use the shared announcement adapter so rerenders do not repeat speech");
      }
      if (callee && KNOWN_HANDOFF_CALLEES.has(callee)) {
        handoffs.push({ file, callee, line: lineFor(sourceFile, node) });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { handoffs, violations };
}

export function findSurfaceRegistryViolations(
  discoveredFiles: readonly string[],
  registered: readonly NativeAccessibilitySurface[],
): string[] {
  const discovered = new Set(discoveredFiles);
  const expected = new Set(registered.map((surface) => surface.file));
  return [
    ...[...discovered].filter((file) => !expected.has(file)).map((file) => `unregistered Expo surface: ${file}`),
    ...[...expected].filter((file) => !discovered.has(file)).map((file) => `stale Expo surface entry: ${file}`),
  ].sort();
}

export function findHandoffRegistryViolations(
  discoveredHandoffs: readonly DiscoveredHandoff[],
  registered: readonly NativeAccessibilityHandoff[],
): string[] {
  const discovered = new Set(discoveredHandoffs.map((item) => `${item.file}|${item.callee}`));
  const expected = new Set(registered.map((item) => `${item.file}|${item.callee}`));
  return [
    ...[...discovered].filter((key) => !expected.has(key)).map((key) => `unregistered native handoff: ${key}`),
    ...[...expected].filter((key) => !discovered.has(key)).map((key) => `stale native handoff entry: ${key}`),
  ].sort();
}

export function findJourneyManifestViolations(
  journeys: readonly NativeAccessibilityJourney[],
): string[] {
  const failures: string[] = [];
  const ids = new Set<string>();
  for (const journey of journeys) {
    if (ids.has(journey.id)) failures.push(`duplicate journey id: ${journey.id}`);
    ids.add(journey.id);
    if (journey.owners.length === 0) failures.push(`${journey.id}: missing GitHub owner`);
    if (journey.surfaces.length === 0) failures.push(`${journey.id}: missing surfaces`);
    if (!journey.openGate.trim()) failures.push(`${journey.id}: missing open gate`);
    for (const state of REQUIRED_JOURNEY_STATES) {
      if (!journey.states.includes(state as any)) failures.push(`${journey.id}: missing ${state} state`);
    }
    for (const kind of REQUIRED_EVIDENCE) {
      if (!(kind in journey.evidence)) failures.push(`${journey.id}: missing ${kind} evidence`);
    }
  }
  if (journeys.length !== 5) failures.push(`expected five priority journeys, found ${journeys.length}`);
  return failures.sort();
}

/**
 * Keeps rendered-test peers out of Expo's production fingerprint graph.
 * pnpm can otherwise satisfy React Native's optional Jest peer across the
 * whole workspace, changing OTA compatibility without changing native code.
 */
export function findAccessibilityTestBoundaryViolations(
  rootPackage: PackageManifest,
  mobilePackage: PackageManifest,
  toolingPackage: PackageManifest,
): string[] {
  const failures: string[] = [];
  const mobileDependencies = {
    ...mobilePackage.dependencies,
    ...mobilePackage.devDependencies,
  };
  const rootDependencies = {
    ...rootPackage.dependencies,
    ...rootPackage.devDependencies,
  };
  const toolingDependencies = {
    ...toolingPackage.dependencies,
    ...toolingPackage.devDependencies,
  };

  for (const dependency of MOBILE_FORBIDDEN_TEST_DEPENDENCIES) {
    if (dependency in mobileDependencies) {
      failures.push(`apps/mobile cannot own accessibility test dependency: ${dependency}`);
    }
  }
  for (const dependency of ROOT_FORBIDDEN_NATIVE_TEST_DEPENDENCIES) {
    if (dependency in rootDependencies) {
      failures.push(`root cannot own React Native test dependency: ${dependency}`);
    }
  }
  for (const dependency of REQUIRED_ISOLATED_TEST_DEPENDENCIES) {
    if (!(dependency in toolingDependencies)) {
      failures.push(`isolated accessibility runner is missing dependency: ${dependency}`);
    }
  }
  for (const script of MOBILE_FORBIDDEN_TEST_SCRIPTS) {
    if (script in (mobilePackage.scripts ?? {})) {
      failures.push(`apps/mobile cannot own accessibility test script: ${script}`);
    }
  }
  for (const script of ["test", "typecheck"] as const) {
    if (!(script in (toolingPackage.scripts ?? {}))) {
      failures.push(`isolated accessibility runner is missing script: ${script}`);
    }
  }

  const rootCheck = rootPackage.scripts?.["check:mobile-accessibility"] ?? "";
  if (
    !rootCheck.includes(
      "corepack pnpm --dir tooling/mobile-accessibility-tests install --frozen-lockfile",
    )
  ) {
    failures.push("root check:mobile-accessibility must frozen-install the isolated runner");
  }
  if (toolingPackage.packageManager !== rootPackage.packageManager) {
    failures.push("isolated accessibility runner must use the root pnpm version");
  }

  return failures.sort();
}

function readPackageManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, path), "utf8")) as PackageManifest;
}

function main(): void {
  const appFiles = [...walkSourceFiles(resolve(REPO_ROOT, MOBILE_APP_ROOT))]
    .filter((file) => file.endsWith(".tsx"))
    .map(repoRelative);
  const surfaceFailures = findSurfaceRegistryViolations(appFiles, nativeAccessibilitySurfaces);
  const excluded = new Set(
    nativeAccessibilitySurfaces
      .filter((surface) => surface.kind === "excluded")
      .map((surface) => surface.file),
  );
  const sourceViolations: AccessibilityViolation[] = [];
  const discoveredHandoffs: DiscoveredHandoff[] = [];
  for (const absoluteFile of walkSourceFiles(resolve(REPO_ROOT, MOBILE_SOURCE_ROOT))) {
    const file = repoRelative(absoluteFile);
    if (excluded.has(file)) continue;
    const scan = scanAccessibilitySource(file, readFileSync(absoluteFile, "utf8"));
    sourceViolations.push(...scan.violations);
    discoveredHandoffs.push(...scan.handoffs);
  }
  const handoffFailures = findHandoffRegistryViolations(
    discoveredHandoffs,
    nativeAccessibilityHandoffs,
  );
  const journeyFailures = findJourneyManifestViolations(nativeAccessibilityJourneys);
  const boundaryFailures = findAccessibilityTestBoundaryViolations(
    readPackageManifest("package.json"),
    readPackageManifest("apps/mobile/package.json"),
    readPackageManifest("tooling/mobile-accessibility-tests/package.json"),
  );
  const failures = [
    ...surfaceFailures,
    ...handoffFailures,
    ...journeyFailures,
    ...boundaryFailures,
    ...sourceViolations.map((violation) =>
      `${violation.code}: ${violation.file}:${violation.line} ${violation.detail}`
    ),
  ];

  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL  ${failure}`);
    console.error(`\n${failures.length} mobile accessibility check(s) failed.`);
    process.exit(1);
  }

  console.log(`PASS  ${appFiles.length} Expo surfaces are classified`);
  console.log(`PASS  ${new Set(discoveredHandoffs.map((item) => `${item.file}|${item.callee}`)).size} native handoffs are registered`);
  console.log(`PASS  ${nativeAccessibilityJourneys.length} priority journeys carry complete evidence dimensions`);
  console.log("PASS  production source uses shared modal, loading, scaling, and announcement policies");
  console.log("PASS  rendered test tooling is isolated from the production fingerprint graph");
}

if (process.argv[1]?.endsWith("mobile-accessibility-check.mts")) main();
