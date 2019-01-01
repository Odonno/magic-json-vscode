import { ExtensionContext, workspace, TextDocument, window, Range, Position } from 'vscode';
import { convertJsonIntoObject, extractInsights, convertSizeToString, Node } from './core';
const jsonMap = require('json-source-map');

/**
 * this method is called when your extension is activated
 * your extension is activated the very first time the command is executed
 */
export const activate = (_: ExtensionContext) => {
	console.log('The extension "magic-json" is now active!');

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

const processActiveFile = async (document: TextDocument) => {
	const { enable } = workspace.getConfiguration('magic-json');

	if (!enable) {
		return;
	}

	if (document && document.languageId === "json") {
		const text = document.getText();

		const o = convertJsonIntoObject(text);
		if (!!o) {
			const insights = extractInsights(o);
			const jsonMapping = jsonMap.parse(text).pointers;

			getEditors(document.fileName).forEach(editor => {
				editor.setDecorations(
					decorationType,
					getDecorations(insights, jsonMapping)
				);
			});
		}
	}
}

const getEditors = (fileName: string) => {
	return window.visibleTextEditors.filter(editor => editor.document.fileName === fileName);
}

const getDecorations = (insights: Node, jsonMapping: any) => {
	// detect first line of the json content
	const firstLine = jsonMapping[''].value.line;
	const firstLineDecorationOptions = {
		renderOptions: {
			after: {
				contentText: convertSizeToString(insights.size) + " - " + insights.type,
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