export type Node = {
    property?: string | undefined;
    type: string;
    isObject: boolean;
    isArray: boolean;
    value: null | boolean | number | string | Node[];
    size: number;
};

type NodePropertyInfo = {
    isObject: boolean;
    isArray: boolean;
    value: null | boolean | number | string | Node[];
};

export const convertJsonIntoObject = (json: string): any => {
    try {
        const o = JSON.parse(json);
        if (o && typeof o === "object") {
            return o;
        }
    } catch (e) { }
    return false;
}

export const extractInsights = (o: any): Node => {
    const childrenNodes = getChildrenNodes(o);
    const childrenSize = childrenNodes
        .map(node => node.size)
        .reduce((a, b) => a + b, 0);

    if (Array.isArray(o)) {
        return {
            type: "[]",
            isObject: false,
            isArray: true,
            value: childrenNodes,
            size: childrenSize
        };
    } else {
        return {
            type: "{}",
            isObject: true,
            isArray: false,
            value: childrenNodes,
            size: childrenSize
        };
    }
}

export const convertSizeToString = (size: number): string => {
    if (size === 0) {
        return '0';
    }
    if (size < 1024) {
        return size + 'B';
    }
    if (size < 1024 * 1024) {
        return (size / 1024).toFixed(2) + 'KB';
    }
    if (size < 1024 * 1024 * 1024) {
        return (size / 1024 / 1024).toFixed(2) + 'MB';
    }
    return size + 'B';
}

export const convertStringToSize = (str: string): number | undefined => {
    if (!str) {
        return undefined;
    }

    const replacedStr = str.toUpperCase().replace(" ", "");
    const sizeRegexResult = /^[0-9]+/.exec(replacedStr);
    const unitRegexResult = /[a-zA-Z]+$/.exec(replacedStr);

    const sizeStr = sizeRegexResult === null ? null : sizeRegexResult[0];
    const unitStr = unitRegexResult === null ? null : unitRegexResult[0];

    if (sizeStr === null) {
        return undefined;
    }

    if (unitStr === "B" || unitStr === null) {
        return parseInt(sizeStr);
    }
    if (unitStr === "KB") {
        return parseInt(sizeStr) * 1024;
    }
    if (unitStr === "MB") {
        return parseInt(sizeStr) * 1024 * 1024;
    }
    if (unitStr === "GB") {
        return parseInt(sizeStr) * 1024 * 1024 * 1024;
    }

    return undefined;
}

const getChildrenNodes = (o: any): Node[] => {
    return Object.keys(o).map(key => {
        const {
            isObject,
            isArray,
            value
        } = getNodePropertyInfo(o[key]);

        return {
            property: key,
            type: getNodeType(isObject, isArray, value),
            isObject,
            isArray,
            value,
            size: calculateSize(key, value)
        };
    });
}

const getNodePropertyInfo = (propertyValue: any): NodePropertyInfo => {
    if (propertyValue === null) {
        return {
            isObject: false,
            isArray: false,
            value: null
        };
    } else if (typeof propertyValue === "object") {
        if (Array.isArray(propertyValue)) {
            return {
                isObject: false,
                isArray: true,
                value: getChildrenNodes(propertyValue)
            };
        } else {
            return {
                isObject: true,
                isArray: false,
                value: getChildrenNodes(propertyValue)
            };
        }
    } else {
        return {
            isObject: false,
            isArray: false,
            value: propertyValue
        };
    }
}

const getNodeType = (isObject: boolean, isArray: boolean, value: null | boolean | number | string | Node[]): string => {
    if (value === null) {
        return "null";
    }
    if (typeof value === "boolean") {
        return "boolean";
    }
    if (typeof value === "number") {
        return "number";
    }
    if (typeof value === "string") {
        return "string";
    }
    if (isObject) {
        return "{}";
    }
    if (isArray) {
        if (value.every(node => node.type === "boolean")) {
            return `boolean[${value.length}]`;
        }
        if (value.every(node => node.type === "number")) {
            return `number[${value.length}]`;
        }
        if (value.every(node => node.type === "string")) {
            return `string[${value.length}]`;
        }
        return `[${value.length}]`;
    }
    return typeof value;
}

const arrayOrObjectContainerSymbolLength = '"": '.length; // '[]' or '{}'
const nullContainerLength = '"": null'.length;
const numberOrBooleanContainerLength = '"": '.length;
const stringContainerLength = '"": ""'.length;

const memoLengthList: any = {};
const withMemoLength = (value: any): number => {
    if (memoLengthList[value] === undefined) {
        memoLengthList[value] = value.toString().length;
    }
    return memoLengthList[value];
}

const calculateSize = (property: string, value: null | boolean | number | string | Node[]): number => {
    if (value === null) {
        return property.length + nullContainerLength;
    } else if (
        typeof value === "number" ||
        typeof value === "boolean") {
        return property.length + numberOrBooleanContainerLength + withMemoLength(value);
    } else if (typeof value === "string") {
        return property.length + stringContainerLength + withMemoLength(value);
    } else if (typeof value === "object") {
        if (Array.isArray(value)) {
            const childrenSize = value
                .map(node => node.size)
                .reduce((a, b) => a + b, 0);

            return property.length + arrayOrObjectContainerSymbolLength + childrenSize;
        }
    }

    return 0;
}