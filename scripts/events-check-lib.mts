import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

type TypeScriptApi = typeof import("../apps/web/node_modules/typescript/lib/typescript.js");
type TypeScriptProgram = ReturnType<TypeScriptApi["createProgram"]>;
type TypeScriptChecker = ReturnType<TypeScriptProgram["getTypeChecker"]>;
type TypeScriptNode = Parameters<TypeScriptApi["forEachChild"]>[0];
type TypeScriptSymbol = NonNullable<
  ReturnType<TypeScriptChecker["getSymbolAtLocation"]>
>;

const requireFromWeb = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const ts = requireFromWeb("typescript") as TypeScriptApi;

const CAPTURE_LOOP_WRAPPERS = new Set([
  "emitNativeCaptureLoopStage",
  "emitWebCaptureLoopStage",
]);
const CAPTURE_LOOP_PERSISTENCE = new Set([
  "persistCaptureLoopEvent",
  "persistCaptureLoopEventWithSql",
]);
const CAPTURE_LOOP_MODULE = /(?:^|\/)capture-loop-events(?:\.[cm]?[jt]s)?$/u;
const CAPTURE_LOOP_EVENT_LITERAL = "product.loop_stage_recorded";

export interface CaptureLoopUsageOptions {
  sourceFiles: ReadonlyArray<string>;
  wrapperModuleFiles: ReadonlyArray<string>;
  captureContractFile: string;
  allowedLowLevelFiles: ReadonlyArray<string>;
}

export interface CaptureLoopUsageAnalysis {
  wrapperCallSites: Set<string>;
  unsupportedWrapperSites: Set<string>;
  lowLevelBypassSites: Set<string>;
  configurationFailures: string[];
}

interface NamedSymbolCollection {
  symbols: Set<TypeScriptSymbol>;
  foundNames: Set<string>;
}

function absolute(path: string): string {
  return resolve(path).replaceAll("\\", "/");
}

function symbolAt(
  checker: TypeScriptChecker,
  node: TypeScriptNode,
): TypeScriptSymbol | undefined {
  return unaliasSymbol(checker, checker.getSymbolAtLocation(node));
}

function unaliasSymbol(
  checker: TypeScriptChecker,
  input: TypeScriptSymbol | undefined,
): TypeScriptSymbol | undefined {
  let symbol = input;
  const seen = new Set<TypeScriptSymbol>();
  while (
    symbol !== undefined &&
    (symbol.flags & ts.SymbolFlags.Alias) !== 0 &&
    !seen.has(symbol)
  ) {
    seen.add(symbol);
    const target = checker.getAliasedSymbol(symbol);
    if (target === symbol) break;
    symbol = target;
  }
  return symbol;
}

function callSymbol(
  checker: TypeScriptChecker,
  node: TypeScriptNode,
): TypeScriptSymbol | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  const expression = node.expression;
  if (ts.isPropertyAccessExpression(expression)) {
    return symbolAt(checker, expression.name) ?? symbolAt(checker, expression);
  }
  if (ts.isElementAccessExpression(expression)) {
    return (
      symbolAt(checker, expression) ??
      (expression.argumentExpression
        ? symbolAt(checker, expression.argumentExpression)
        : undefined)
    );
  }
  return symbolAt(checker, expression);
}

function containsDynamicImport(node: TypeScriptNode): boolean {
  let found = false;
  const visit = (current: TypeScriptNode): void => {
    if (
      ts.isCallExpression(current) &&
      current.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      found = true;
      return;
    }
    if (!found) ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function isImportExportOrDeclaration(node: TypeScriptNode): boolean {
  const parent = node.parent;
  return (
    (ts.isFunctionDeclaration(parent) && parent.name === node) ||
    (ts.isVariableDeclaration(parent) && parent.name === node) ||
    ts.isImportSpecifier(parent) ||
    ts.isExportSpecifier(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isImportClause(parent)
  );
}

function isDirectStaticCallReference(node: TypeScriptNode): boolean {
  const parent = node.parent;
  if (ts.isCallExpression(parent) && parent.expression === node) return true;
  return (
    ts.isPropertyAccessExpression(parent) &&
    parent.name === node &&
    ts.isCallExpression(parent.parent) &&
    parent.parent.expression === parent &&
    !containsDynamicImport(parent)
  );
}

function enclosingFunctionName(node: TypeScriptNode): string | null {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }
    if (ts.isMethodDeclaration(current) && current.name) {
      return staticPropertyNameFromSyntax(current.name);
    }
    if (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
      if (ts.isFunctionExpression(current) && current.name) {
        return current.name.text;
      }
      const declaration = current.parent;
      if (
        ts.isVariableDeclaration(declaration) &&
        ts.isIdentifier(declaration.name)
      ) {
        return declaration.name.text;
      }
      return null;
    }
    current = current.parent;
  }
  return null;
}

function staticPropertyNameFromSyntax(node: TypeScriptNode): string | null {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null;
}

function isAllowedAdapterPersistenceCall(
  persistenceName: string,
  callerName: string | null,
): boolean {
  return (
    (persistenceName === "persistCaptureLoopEvent" &&
      callerName === "emitWebCaptureLoopStage") ||
    (persistenceName === "persistCaptureLoopEventWithSql" &&
      callerName === "persistCaptureLoopEvent")
  );
}

function collectNamedSymbols(
  program: TypeScriptProgram,
  checker: TypeScriptChecker,
  files: ReadonlyArray<string>,
  names: ReadonlySet<string>,
): NamedSymbolCollection {
  const symbols = new Set<TypeScriptSymbol>();
  const foundNames = new Set<string>();
  for (const path of files.map(absolute)) {
    const source = program.getSourceFile(path);
    if (!source) continue;
    const visit = (node: TypeScriptNode): void => {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        names.has(node.name.text)
      ) {
        const symbol = symbolAt(checker, node.name);
        if (symbol) {
          symbols.add(symbol);
          foundNames.add(node.name.text);
        }
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        names.has(node.name.text)
      ) {
        const symbol = symbolAt(checker, node.name);
        if (symbol) {
          symbols.add(symbol);
          foundNames.add(node.name.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { symbols, foundNames };
}

function collectCaptureEventSymbol(
  program: TypeScriptProgram,
  checker: TypeScriptChecker,
  path: string,
): TypeScriptSymbol | undefined {
  const source = program.getSourceFile(absolute(path));
  if (!source) return undefined;
  let result: TypeScriptSymbol | undefined;
  const visit = (node: TypeScriptNode): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "CAPTURE_LOOP_EVENT_NAME"
    ) {
      result = symbolAt(checker, node.name);
      return;
    }
    if (!result) ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

function isDirectCaptureLoopDynamicImport(node: TypeScriptNode): boolean {
  return (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0]) &&
    CAPTURE_LOOP_MODULE.test(node.arguments[0].text)
  );
}

function isCaptureLoopEventArgument(
  checker: TypeScriptChecker,
  node: TypeScriptNode,
): boolean {
  return staticStringValue(checker, node) === CAPTURE_LOOP_EVENT_LITERAL;
}

function accessedPropertySymbol(
  checker: TypeScriptChecker,
  node: TypeScriptNode,
): TypeScriptSymbol | undefined {
  if (ts.isPropertyAccessExpression(node)) {
    return symbolAt(checker, node.name) ?? symbolAt(checker, node);
  }
  if (
    ts.isElementAccessExpression(node) &&
    node.argumentExpression !== undefined
  ) {
    const direct = symbolAt(checker, node);
    if (direct) return direct;
    const key = staticStringValue(checker, node.argumentExpression);
    if (key === null) return undefined;
    return unaliasSymbol(
      checker,
      checker.getPropertyOfType(checker.getTypeAtLocation(node.expression), key),
    );
  }
  return undefined;
}

function bindingElementPropertySymbol(
  checker: TypeScriptChecker,
  declaration: TypeScriptNode,
): TypeScriptSymbol | undefined {
  if (
    !ts.isBindingElement(declaration) ||
    declaration.dotDotDotToken ||
    !ts.isObjectBindingPattern(declaration.parent)
  ) {
    return undefined;
  }
  let owner: TypeScriptNode = declaration.parent;
  while (
    !ts.isVariableDeclaration(owner) &&
    !ts.isSourceFile(owner) &&
    owner.parent
  ) {
    owner = owner.parent;
  }
  if (
    !ts.isVariableDeclaration(owner) ||
    !ts.isVariableDeclarationList(owner.parent) ||
    (owner.parent.flags & ts.NodeFlags.Const) === 0
  ) {
    return undefined;
  }
  const propertyNode = declaration.propertyName ?? declaration.name;
  if (ts.isBindingPattern(propertyNode)) return undefined;
  const propertyName = staticPropertyName(checker, propertyNode);
  if (propertyName === null) return undefined;
  const sourceType = owner.initializer
    ? checker.getTypeAtLocation(owner.initializer)
    : checker.getTypeAtLocation(declaration.parent);
  return unaliasSymbol(
    checker,
    checker.getPropertyOfType(sourceType, propertyName),
  );
}

function staticArrayElementsFromSymbol(
  checker: TypeScriptChecker,
  symbol: TypeScriptSymbol,
  depth: number,
  seenSymbols: Set<TypeScriptSymbol>,
): ReadonlyArray<TypeScriptNode> | null {
  if (depth > 12 || seenSymbols.has(symbol)) return null;
  const declarations = [
    symbol.valueDeclaration,
    ...(symbol.declarations ?? []),
  ].filter(
    (declaration, index, all): declaration is TypeScriptNode =>
      declaration !== undefined && all.indexOf(declaration) === index,
  );
  seenSymbols.add(symbol);
  try {
    for (const declaration of declarations) {
      let initializer: TypeScriptNode | undefined;
      if (
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        ts.isVariableDeclarationList(declaration.parent) &&
        (declaration.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        initializer = declaration.initializer;
      } else if (ts.isPropertyAssignment(declaration)) {
        initializer = declaration.initializer;
      } else if (ts.isShorthandPropertyAssignment(declaration)) {
        const valueSymbol = checker.getShorthandAssignmentValueSymbol(declaration);
        if (valueSymbol) {
          const elements = staticArrayElementsFromSymbol(
            checker,
            unaliasSymbol(checker, valueSymbol) ?? valueSymbol,
            depth + 1,
            seenSymbols,
          );
          if (elements !== null) return elements;
        }
      } else if (ts.isBindingElement(declaration)) {
        const valueSymbol = bindingElementPropertySymbol(checker, declaration);
        if (valueSymbol) {
          const elements = staticArrayElementsFromSymbol(
            checker,
            valueSymbol,
            depth + 1,
            seenSymbols,
          );
          if (elements !== null) return elements;
        }
        initializer = declaration.initializer;
      }
      if (initializer) {
        const elements = staticArrayElements(
          checker,
          initializer,
          depth + 1,
          seenSymbols,
        );
        if (elements !== null) return elements;
      }
    }
    return null;
  } finally {
    seenSymbols.delete(symbol);
  }
}

function staticArrayElements(
  checker: TypeScriptChecker,
  node: TypeScriptNode,
  depth: number,
  seenSymbols: Set<TypeScriptSymbol>,
): ReadonlyArray<TypeScriptNode> | null {
  if (depth > 12) return null;
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return staticArrayElements(
      checker,
      node.expression,
      depth + 1,
      seenSymbols,
    );
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements;
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    const symbol = accessedPropertySymbol(checker, node);
    if (symbol) {
      return staticArrayElementsFromSymbol(
        checker,
        symbol,
        depth + 1,
        seenSymbols,
      );
    }
  }
  if (ts.isIdentifier(node)) {
    const symbol = symbolAt(checker, node);
    if (symbol) {
      return staticArrayElementsFromSymbol(
        checker,
        symbol,
        depth + 1,
        seenSymbols,
      );
    }
  }
  return null;
}

function staticArrayStringValues(
  checker: TypeScriptChecker,
  elements: ReadonlyArray<TypeScriptNode>,
  depth: number,
  seenSymbols: Set<TypeScriptSymbol>,
): string[] | null {
  if (depth > 12) return null;
  const values: string[] = [];
  for (const element of elements) {
    if (ts.isSpreadElement(element)) {
      const spreadElements = staticArrayElements(
        checker,
        element.expression,
        depth + 1,
        seenSymbols,
      );
      if (spreadElements === null) return null;
      const spreadValues = staticArrayStringValues(
        checker,
        spreadElements,
        depth + 1,
        seenSymbols,
      );
      if (spreadValues === null) return null;
      values.push(...spreadValues);
      continue;
    }
    const value = staticStringValue(
      checker,
      element,
      depth + 1,
      seenSymbols,
    );
    if (value === null) return null;
    values.push(value);
  }
  return values;
}

function staticStringValue(
  checker: TypeScriptChecker,
  node: TypeScriptNode,
  depth = 0,
  seenSymbols = new Set<TypeScriptSymbol>(),
): string | null {
  if (depth > 12) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return staticStringValue(checker, node.expression, depth + 1, seenSymbols);
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticStringValue(checker, node.left, depth + 1, seenSymbols);
    const right = staticStringValue(checker, node.right, depth + 1, seenSymbols);
    return left === null || right === null ? null : left + right;
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      const expression = staticStringValue(
        checker,
        span.expression,
        depth + 1,
        seenSymbols,
      );
      if (expression === null) return null;
      value += expression + span.literal.text;
    }
    return value;
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression)
  ) {
    const target = node.expression.expression;
    const joinedElements =
      node.expression.name.text === "join"
        ? staticArrayElements(checker, target, depth + 1, seenSymbols)
        : null;
    if (
      node.expression.name.text === "join" &&
      joinedElements !== null &&
      node.arguments.length <= 1
    ) {
      const separator =
        node.arguments.length === 0
          ? ","
          : staticStringValue(
              checker,
              node.arguments[0],
              depth + 1,
              seenSymbols,
            );
      if (separator === null) return null;
      const values = staticArrayStringValues(
        checker,
        joinedElements,
        depth + 1,
        seenSymbols,
      );
      if (values === null) return null;
      return values.join(separator);
    }
    if (node.expression.name.text === "concat") {
      const base = staticStringValue(checker, target, depth + 1, seenSymbols);
      if (base === null) return null;
      let value = base;
      for (const argument of node.arguments) {
        const suffix = staticStringValue(
          checker,
          argument,
          depth + 1,
          seenSymbols,
        );
        if (suffix === null) return null;
        value += suffix;
      }
      return value;
    }
  }
  if (ts.isIdentifier(node)) {
    const symbol = symbolAt(checker, node);
    if (symbol && !seenSymbols.has(symbol)) {
      const declaration = symbol.valueDeclaration;
      if (
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        ts.isVariableDeclarationList(declaration.parent) &&
        (declaration.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        seenSymbols.add(symbol);
        const value = staticStringValue(
          checker,
          declaration.initializer,
          depth + 1,
          seenSymbols,
        );
        seenSymbols.delete(symbol);
        if (value !== null) return value;
      }
    }
  }
  const type = checker.getTypeAtLocation(node);
  return type.isStringLiteral() ? type.value : null;
}

function staticPropertyName(
  checker: TypeScriptChecker,
  node: TypeScriptNode,
): string | null {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  if (ts.isComputedPropertyName(node)) {
    return staticStringValue(checker, node.expression);
  }
  return null;
}

export function analyzeCaptureLoopUsage(
  options: CaptureLoopUsageOptions,
): CaptureLoopUsageAnalysis {
  const rootNames = [
    ...options.sourceFiles,
    ...options.wrapperModuleFiles,
    options.captureContractFile,
  ].map(absolute);
  const absoluteWrapperFiles = options.wrapperModuleFiles.map(absolute);
  const webWrapperFile =
    absoluteWrapperFiles.find((path) => path.includes("/web/")) ??
    absoluteWrapperFiles[0] ??
    absolute(options.captureContractFile);
  const mobileWrapperFile =
    absoluteWrapperFiles.find((path) => path.includes("/mobile/")) ??
    webWrapperFile;
  const aliasRoot = (wrapperFile: string): string => {
    const parent = dirname(wrapperFile);
    return parent.endsWith("/lib") ? dirname(parent) : parent;
  };
  const webAliasRoot = aliasRoot(webWrapperFile);
  const mobileAliasRoot = aliasRoot(mobileWrapperFile);
  const compilerOptions: Parameters<TypeScriptApi["createCompilerHost"]>[0] = {
    allowJs: true,
    allowImportingTsExtensions: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
  };
  const compilerHost = ts.createCompilerHost(compilerOptions);
  const moduleResolutionCache = ts.createModuleResolutionCache(
    webAliasRoot,
    compilerHost.getCanonicalFileName,
    compilerOptions,
  );
  const resolveAppAlias = (
    moduleName: string,
    containingFile: string,
  ): string => {
    if (!moduleName.startsWith("@/")) return moduleName;
    const containingPath = absolute(containingFile);
    const mobileSource =
      containingPath === mobileAliasRoot ||
      containingPath.startsWith(`${mobileAliasRoot}/`);
    const wrapperFile = mobileSource ? mobileWrapperFile : webWrapperFile;
    const root = mobileSource ? mobileAliasRoot : webAliasRoot;
    if (moduleName.startsWith("@/lib/")) {
      return resolve(dirname(wrapperFile), moduleName.slice("@/lib/".length));
    }
    return resolve(root, moduleName.slice(2));
  };
  compilerHost.resolveModuleNameLiterals = (
    moduleLiterals,
    containingFile,
    redirectedReference,
    resolutionOptions,
  ) =>
    moduleLiterals.map((moduleLiteral) =>
      ts.resolveModuleName(
        resolveAppAlias(moduleLiteral.text, containingFile),
        containingFile,
        resolutionOptions,
        compilerHost,
        moduleResolutionCache,
        redirectedReference,
      ),
    );
  const program = ts.createProgram({
    rootNames: [...new Set(rootNames)],
    options: compilerOptions,
    host: compilerHost,
  });
  const checker = program.getTypeChecker();
  const wrapperCollection = collectNamedSymbols(
    program,
    checker,
    options.wrapperModuleFiles,
    CAPTURE_LOOP_WRAPPERS,
  );
  const persistenceCollection = collectNamedSymbols(
    program,
    checker,
    options.wrapperModuleFiles,
    CAPTURE_LOOP_PERSISTENCE,
  );
  const captureEventSymbol = collectCaptureEventSymbol(
    program,
    checker,
    options.captureContractFile,
  );
  const wrapperSymbols = wrapperCollection.symbols;
  const persistenceSymbols = persistenceCollection.symbols;
  const allowedLowLevelFiles = new Set(options.allowedLowLevelFiles.map(absolute));
  const wrapperModuleFiles = new Set(options.wrapperModuleFiles.map(absolute));
  const wrapperCallSites = new Set<string>();
  const unsupportedWrapperSites = new Set<string>();
  const lowLevelBypassSites = new Set<string>();
  const configurationFailures = new Set<string>();
  for (const name of CAPTURE_LOOP_WRAPPERS) {
    if (!wrapperCollection.foundNames.has(name)) {
      configurationFailures.add(`missing canonical wrapper symbol ${name}`);
    }
  }
  for (const name of CAPTURE_LOOP_PERSISTENCE) {
    if (!persistenceCollection.foundNames.has(name)) {
      configurationFailures.add(`missing capture persistence symbol ${name}`);
    }
  }
  if (!captureEventSymbol) {
    configurationFailures.add("missing canonical capture event symbol");
  }

  for (const inputPath of options.sourceFiles) {
    const path = absolute(inputPath);
    const source = program.getSourceFile(path);
    if (!source || /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path)) continue;
    const syntacticWrapperNames = new Set<string>();
    const syntacticPersistenceNames = new Set<string>();
    const syntacticNamespaces = new Set<string>();
    for (const statement of source.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        const importsCanonicalModule = CAPTURE_LOOP_MODULE.test(
          statement.moduleSpecifier.text,
        );
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            const importedName = element.propertyName?.text ?? element.name.text;
            if (CAPTURE_LOOP_WRAPPERS.has(importedName)) {
              syntacticWrapperNames.add(element.name.text);
            }
            if (CAPTURE_LOOP_PERSISTENCE.has(importedName)) {
              syntacticPersistenceNames.add(element.name.text);
            }
          }
        } else if (
          bindings &&
          ts.isNamespaceImport(bindings) &&
          (importsCanonicalModule || statement.moduleSpecifier.text.startsWith("@/"))
        ) {
          syntacticNamespaces.add(bindings.name.text);
        }
      }
      if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        const exportsCanonicalModule = CAPTURE_LOOP_MODULE.test(
          statement.moduleSpecifier.text,
        );
        if (
          exportsCanonicalModule &&
          (statement.exportClause === undefined ||
            ts.isNamespaceExport(statement.exportClause))
        ) {
          configurationFailures.add(
            `indirect capture-loop namespace re-export in ${inputPath}`,
          );
        } else if (
          statement.exportClause &&
          ts.isNamedExports(statement.exportClause)
        ) {
          for (const element of statement.exportClause.elements) {
            const importedName = element.propertyName?.text ?? element.name.text;
            const resolved = symbolAt(
              checker,
              element.propertyName ?? element.name,
            );
            const resolvesWrapper =
              resolved !== undefined && wrapperSymbols.has(resolved);
            const resolvesPersistence =
              resolved !== undefined && persistenceSymbols.has(resolved);
            const resolvesCapability = resolvesWrapper || resolvesPersistence;
            if (
              resolvesCapability &&
              element.name.text !== resolved?.getName()
            ) {
              configurationFailures.add(
                `aliased capture-loop re-export in ${inputPath}`,
              );
            } else if (
              exportsCanonicalModule &&
              (CAPTURE_LOOP_WRAPPERS.has(importedName) ||
                CAPTURE_LOOP_PERSISTENCE.has(importedName)) &&
              !resolved
            ) {
              configurationFailures.add(
                `unresolved capture-loop re-export in ${inputPath}`,
              );
            }
          }
        }
      }
    }
    const visit = (node: TypeScriptNode): void => {
      if (isDirectCaptureLoopDynamicImport(node)) {
        unsupportedWrapperSites.add(inputPath);
      }
      if (ts.isCallExpression(node)) {
        if (containsDynamicImport(node.expression)) {
          const dynamicMember = ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name.text
            : ts.isElementAccessExpression(node.expression) &&
                node.expression.argumentExpression !== undefined &&
                ts.isStringLiteral(node.expression.argumentExpression)
              ? node.expression.argumentExpression.text
              : null;
          if (dynamicMember && CAPTURE_LOOP_WRAPPERS.has(dynamicMember)) {
            unsupportedWrapperSites.add(inputPath);
          }
          if (
            dynamicMember &&
            CAPTURE_LOOP_PERSISTENCE.has(dynamicMember) &&
            !allowedLowLevelFiles.has(path)
          ) {
            lowLevelBypassSites.add(inputPath);
          }
        }
        const callsCaptureLoopEvent = node.arguments.some((argument) =>
          isCaptureLoopEventArgument(checker, argument),
        );
        const adapterEventBypass =
          wrapperModuleFiles.has(path) &&
          callsCaptureLoopEvent &&
          enclosingFunctionName(node) !== "emitNativeCaptureLoopStage";
        if (
          callsCaptureLoopEvent &&
          (!allowedLowLevelFiles.has(path) || adapterEventBypass)
        ) {
          lowLevelBypassSites.add(inputPath);
        }
        const symbol = callSymbol(checker, node);
        const syntacticIdentifierWrapper =
          ts.isIdentifier(node.expression) &&
          syntacticWrapperNames.has(node.expression.text);
        const syntacticNamespaceWrapper =
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          syntacticNamespaces.has(node.expression.expression.text) &&
          CAPTURE_LOOP_WRAPPERS.has(node.expression.name.text);
        const syntacticElementWrapper =
          ts.isElementAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          syntacticNamespaces.has(node.expression.expression.text) &&
          node.expression.argumentExpression !== undefined &&
          CAPTURE_LOOP_WRAPPERS.has(
            staticStringValue(
              checker,
              node.expression.argumentExpression,
            ) ?? "",
          );
        const syntacticElementPersistence =
          ts.isElementAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          syntacticNamespaces.has(node.expression.expression.text) &&
          node.expression.argumentExpression !== undefined &&
          CAPTURE_LOOP_PERSISTENCE.has(
            staticStringValue(
              checker,
              node.expression.argumentExpression,
            ) ?? "",
          );
        const persistenceName =
          symbol && persistenceSymbols.has(symbol)
            ? symbol.getName()
            : ts.isIdentifier(node.expression) &&
                CAPTURE_LOOP_PERSISTENCE.has(node.expression.text)
              ? node.expression.text
              : ts.isPropertyAccessExpression(node.expression) &&
                  CAPTURE_LOOP_PERSISTENCE.has(node.expression.name.text)
                ? node.expression.name.text
                : ts.isElementAccessExpression(node.expression) &&
                    node.expression.argumentExpression !== undefined
                  ? staticStringValue(
                      checker,
                      node.expression.argumentExpression,
                    )
                  : null;
        const adapterPersistenceBypass =
          wrapperModuleFiles.has(path) &&
          persistenceName !== null &&
          CAPTURE_LOOP_PERSISTENCE.has(persistenceName) &&
          !isAllowedAdapterPersistenceCall(
            persistenceName,
            enclosingFunctionName(node),
          );
        if (
          (symbol && wrapperSymbols.has(symbol)) ||
          syntacticIdentifierWrapper ||
          syntacticNamespaceWrapper ||
          syntacticElementWrapper
        ) {
          const directSyntax =
            ts.isIdentifier(node.expression) ||
            ts.isPropertyAccessExpression(node.expression);
          if (wrapperModuleFiles.has(path)) {
            unsupportedWrapperSites.add(inputPath);
          } else if (directSyntax && !containsDynamicImport(node.expression)) {
            wrapperCallSites.add(inputPath);
          } else {
            unsupportedWrapperSites.add(inputPath);
          }
        }
        if (
          ((symbol && persistenceSymbols.has(symbol)) ||
            (ts.isIdentifier(node.expression) &&
              syntacticPersistenceNames.has(node.expression.text)) ||
            (ts.isPropertyAccessExpression(node.expression) &&
              ts.isIdentifier(node.expression.expression) &&
              syntacticNamespaces.has(node.expression.expression.text) &&
              CAPTURE_LOOP_PERSISTENCE.has(node.expression.name.text)) ||
            syntacticElementPersistence) &&
          (!allowedLowLevelFiles.has(path) || adapterPersistenceBypass)
        ) {
          lowLevelBypassSites.add(inputPath);
        }
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer !== undefined
      ) {
        for (const element of node.name.elements) {
          const importedName = element.propertyName
            ? staticPropertyName(checker, element.propertyName)
            : ts.isIdentifier(element.name)
              ? element.name.text
              : null;
          const initializerType = checker.getTypeAtLocation(node.initializer);
          const resolvedProperty = importedName
            ? unaliasSymbol(
                checker,
                checker.getPropertyOfType(initializerType, importedName),
              )
            : undefined;
          const isWrapper =
            (importedName !== null && CAPTURE_LOOP_WRAPPERS.has(importedName)) ||
            (resolvedProperty !== undefined && wrapperSymbols.has(resolvedProperty));
          const isPersistence =
            (importedName !== null &&
              CAPTURE_LOOP_PERSISTENCE.has(importedName)) ||
            (resolvedProperty !== undefined &&
              persistenceSymbols.has(resolvedProperty));
          if (isWrapper) {
            unsupportedWrapperSites.add(inputPath);
          }
          if (
            isPersistence &&
            !allowedLowLevelFiles.has(path)
          ) {
            lowLevelBypassSites.add(inputPath);
          }
        }
      }
      if (ts.isIdentifier(node)) {
        const symbol = symbolAt(checker, node);
        const knownWrapper =
          (symbol !== undefined && wrapperSymbols.has(symbol)) ||
          syntacticWrapperNames.has(node.text);
        const knownNamespaceMember =
          ts.isPropertyAccessExpression(node.parent) &&
          node.parent.name === node &&
          ts.isIdentifier(node.parent.expression) &&
          syntacticNamespaces.has(node.parent.expression.text);
        if (
          knownWrapper &&
          !isImportExportOrDeclaration(node) &&
          !isDirectStaticCallReference(node)
        ) {
          unsupportedWrapperSites.add(inputPath);
        }
        if (
          CAPTURE_LOOP_WRAPPERS.has(node.text) &&
          !knownWrapper &&
          !knownNamespaceMember &&
          !isImportExportOrDeclaration(node)
        ) {
          unsupportedWrapperSites.add(inputPath);
        }
        if (
          ((symbol !== undefined && persistenceSymbols.has(symbol)) ||
            syntacticPersistenceNames.has(node.text) ||
            CAPTURE_LOOP_PERSISTENCE.has(node.text)) &&
          !allowedLowLevelFiles.has(path) &&
          !isImportExportOrDeclaration(node)
        ) {
          lowLevelBypassSites.add(inputPath);
        }
        if (
          captureEventSymbol &&
          symbol === captureEventSymbol &&
          !allowedLowLevelFiles.has(path) &&
          !isImportExportOrDeclaration(node)
        ) {
          lowLevelBypassSites.add(inputPath);
        }
      }
      const staticProtectedValue =
        ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
          ? node.text
          : ts.isBinaryExpression(node) ||
              ts.isTemplateExpression(node) ||
              ts.isCallExpression(node)
            ? staticStringValue(checker, node)
            : null;
      if (staticProtectedValue !== null) {
        if (CAPTURE_LOOP_WRAPPERS.has(staticProtectedValue)) {
          unsupportedWrapperSites.add(inputPath);
        }
        if (
          CAPTURE_LOOP_PERSISTENCE.has(staticProtectedValue) &&
          (!allowedLowLevelFiles.has(path) || wrapperModuleFiles.has(path))
        ) {
          lowLevelBypassSites.add(inputPath);
        }
        if (
          staticProtectedValue === CAPTURE_LOOP_EVENT_LITERAL &&
          path !== absolute(options.captureContractFile) &&
          (!allowedLowLevelFiles.has(path) || wrapperModuleFiles.has(path))
        ) {
          lowLevelBypassSites.add(inputPath);
        }
      }
      if (
        ts.isElementAccessExpression(node) &&
        node.argumentExpression !== undefined
      ) {
        const member = staticStringValue(
          checker,
          node.argumentExpression,
        );
        if (member && CAPTURE_LOOP_WRAPPERS.has(member)) {
          unsupportedWrapperSites.add(inputPath);
        }
        if (
          member &&
          CAPTURE_LOOP_PERSISTENCE.has(member) &&
          !allowedLowLevelFiles.has(path)
        ) {
          lowLevelBypassSites.add(inputPath);
        }
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        syntacticNamespaces.has(node.expression.text) &&
        (CAPTURE_LOOP_WRAPPERS.has(node.name.text) ||
          CAPTURE_LOOP_PERSISTENCE.has(node.name.text))
      ) {
        const parent = node.parent;
        const directCall =
          ts.isCallExpression(parent) && parent.expression === node;
        if (!directCall && CAPTURE_LOOP_WRAPPERS.has(node.name.text)) {
          unsupportedWrapperSites.add(inputPath);
        }
        if (
          !allowedLowLevelFiles.has(path) &&
          CAPTURE_LOOP_PERSISTENCE.has(node.name.text)
        ) {
          lowLevelBypassSites.add(inputPath);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return {
    wrapperCallSites,
    unsupportedWrapperSites,
    lowLevelBypassSites,
    configurationFailures: [...configurationFailures].sort(),
  };
}

export function captureLoopStagingMatches(
  isStaged: boolean,
  wrapperCallSites: ReadonlySet<string>,
): boolean {
  return isStaged ? wrapperCallSites.size === 0 : wrapperCallSites.size > 0;
}
