import { ExtensionContext, workspace, TextDocument, window, Range, Position, WorkspaceConfiguration, commands } from 'vscode';
import { convertJsonIntoObject, extractInsights, convertSizeToString, Node, convertStringToSize } from './core';
const jsonMap = require('json-source-map');
const micromatch = require('micromatch');

enum Mode {
	BASED_ON_IGNORE_LIST = "BASED_ON_IGNORE_LIST",
	MANUALLY_ACTIVATED = "MANUALLY_ACTIVATED",
	MANUALLY_DEACTIVATED = "MANUALLY_DEACTIVATED",
}

type ColorSizeLimit = {
	from: string;
	to: string;
	color: string;
};
type ColorMatchLimit = {
	from: number | undefined;
	to: number | undefined;
	color: string;
};
type MagicJsonConfiguration = {
	enable: boolean | undefined;
	colorSizeLimits: ColorSizeLimit[] | undefined;
	ignoreFiles: string[];
} & WorkspaceConfiguration;

type FileConfiguration = {
	mode: Mode;
	isMatch: boolean;
}

let files: Map<string, FileConfiguration> = new Map();
/**
 * this method is called when your extension is activated
 * your extension is activated the very first time the command is executed
 */
export const activate = (context: ExtensionContext) => {
	console.log('The extension "magic-json" is now active!');

	const command = 'magic-json.toggle';
	const commandHandler = () => {
		if (window.activeTextEditor) {
			processActiveFile(window.activeTextEditor.document, true);
		}
	};
	context.subscriptions.push(commands.registerCommand(command, commandHandler));

	workspace.onDidChangeTextDocument(event => processActiveFile(event.document));
	window.onDidChangeActiveTextEditor(event => event && processActiveFile(event.document));
	if (window.activeTextEditor) {
		processActiveFile(window.activeTextEditor.document);
	}
}

/**
 * this method is called when your extension is deactivated
 */
export const deactivate = () => { }

const decorationType = window.createTextEditorDecorationType({ after: { margin: '0 0 0 1rem' } });

const processActiveFile = async (document: TextDocument, force: boolean = false) => {
	const documentUri = document.uri.toString();
	const { enable, ignoreFiles } = workspace.getConfiguration('magic-json') as MagicJsonConfiguration;
	const isMatch = ignoreFiles && micromatch.contains(document.fileName, ignoreFiles);

	if (!enable) {
		return;
	}

	if (document && document.languageId === "json") {
		if (!files.has(documentUri)) {
			files.set(documentUri, {
				mode: Mode.BASED_ON_IGNORE_LIST,
				isMatch,
			});
		} else {
			const { mode } = files.get(documentUri) as FileConfiguration;
			if (force) {
				let config;
				if (mode === Mode.BASED_ON_IGNORE_LIST && isMatch) {
					config = {
						mode: Mode.MANUALLY_ACTIVATED,
						isMatch,
					};
				}
				if (mode === Mode.BASED_ON_IGNORE_LIST && !isMatch) {
					config = {
						mode: Mode.MANUALLY_DEACTIVATED,
						isMatch,
					}
				}
				if (mode === Mode.MANUALLY_ACTIVATED) {
					config = {
						mode: Mode.MANUALLY_DEACTIVATED,
						isMatch,
					}
				}
				if (mode === Mode.MANUALLY_DEACTIVATED) {
					config = {
						mode: Mode.MANUALLY_ACTIVATED,
						isMatch,
					}
				}
				config && setFiles(documentUri, config);
			}
		}

		const { mode } = files.get(documentUri) as FileConfiguration;
		mode && isApplied(mode, isMatch) ? applyDecoration(document) : removeDecoration(document);
	}
}

const isApplied = (mode: Mode, isMatch: boolean) => {
	if (mode === Mode.BASED_ON_IGNORE_LIST && !isMatch || mode === Mode.MANUALLY_ACTIVATED) {
		return true
	}
	return false
}

const setFiles = (documentUri: string, config: FileConfiguration) => {
	files.set(documentUri, config);
}

const applyDecoration = (document: TextDocument) => {
	const text = document.getText();
	const o = convertJsonIntoObject(text);
	if (!!o) {
		const insights = extractInsights(o);
		const jsonMapping = jsonMap.parse(text).pointers;

		getEditors(document.fileName).forEach((editor) => {
			editor.setDecorations(
				decorationType,
				getDecorations(insights, jsonMapping)
			);
		});
	}
}

const removeDecoration = (document: TextDocument) => {
	getEditors(document.fileName).forEach((editor) => {
		editor.setDecorations(
			decorationType,
			[]
		);
	});
}

const getEditors = (fileName: string) => {
	return window.visibleTextEditors.filter(editor => editor.document.fileName === fileName);
}

const getDecorations = (insights: Node, jsonMapping: any) => {
	const { colorSizeLimits } = workspace.getConfiguration('magic-json') as MagicJsonConfiguration;
	const colorMatchLimits: ColorMatchLimit[] = !colorSizeLimits ? [] : colorSizeLimits.map(x => {
		return {
			from: convertStringToSize(x.from),
			to: convertStringToSize(x.to),
			color: x.color
		}
	});

	// detect first line of the json content
	const firstLine = jsonMapping[''].value.line;
	const firstLineDecorationOptions = {
		renderOptions: {
			after: {
				contentText: convertSizeToString(insights.size) + " - " + insights.type,
				color: getColor(insights.size, colorMatchLimits),
				fontStyle: "italic"
			}
		},
		range: new Range(new Position(firstLine, 1024), new Position(firstLine, 1024))
	};

	// detect & create decorations for children nodes
	const jsonMapKeyValues = Object.keys(jsonMapping)
		.map(key => {
			return {
				key,
				content: jsonMapping[key]
			};
		})
		.filter(x => !!x.content.key);

	const linesWithJsonKey = jsonMapKeyValues
		.map(x => x.content.key.line)
		.filter(line => line > firstLine)
		.filter((item, index, array) => array.indexOf(item) === index);

	const linesDecorationOptions = linesWithJsonKey
		.map(line => {
			const mappedKeyValues = jsonMapKeyValues.filter(x => x.content.key.line === line);
			return {
				line,
				node: findNodeByKey(insights, mappedKeyValues[0].key),
				numberOfNodes: mappedKeyValues.length
			};
		})
		.filter(x => !!x.node)
		.filter(x => x.numberOfNodes === 1)
		.map(({ line, node }) => {
			return {
				renderOptions: {
					after: {
						contentText: node ? (convertSizeToString(node.size) + " - " + node.type) : "",
						color: getColor(node ? node.size : undefined, colorMatchLimits),
						fontStyle: "italic"
					}
				},
				range: new Range(new Position(line, 1024), new Position(line, 1024))
			};
		});

	return [firstLineDecorationOptions].concat(linesDecorationOptions);
}

const findNodeByKey = (insights: Node, key: string) => {
	const findNodeFromPath = (node: Node, path: string[]): Node | null => {
		if (path.length === 0) {
			return node;
		}

		if (node.value !== null && typeof node.value !== "boolean" && typeof node.value !== "number" && typeof node.value !== "string") {
			return findNodeFromPath(
				node.value.filter(n => n.property === path[0])[0],
				path.filter((_, i) => i > 0)
			);
		}
		return null;
	}

	const path = key.split('/').filter((_, i) => i > 0);
	return findNodeFromPath(insights, path);
}

const getColor = (size: number | undefined, colorMatchLimits: ColorMatchLimit[]) => {
	if (size === undefined || !colorMatchLimits || colorMatchLimits.length === 0) {
		return undefined;
	}

	const matchLimits = colorMatchLimits.filter(({ from, to }) => {
		if (from !== undefined && to !== undefined) {
			return size >= from && size < to;
		}
		if (from !== undefined) {
			return size >= from;
		}
		if (to !== undefined) {
			return size < to;
		}
		return false;
	});

	if (matchLimits.length > 0) {
		return matchLimits[0].color;
	}

	return undefined;
}