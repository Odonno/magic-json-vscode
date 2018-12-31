export type RootNode = {
    children: ChildNode[];
};

export type ChildNode = {
    property: string;
    type: string;
    isObject: boolean;
    isArray: boolean;
    value: null | boolean | number | string | ChildNode[];
    size: number;
};

type NodePropertyInfo = {
    isObject: boolean;
    isArray: boolean;
    value: null | boolean | number | string | ChildNode[];
};

export const isValidJson = (json: string): any | false => {
    try {
        const o = JSON.parse(json);
        if (o && typeof o === "object") {
            return o;
        }
    } catch (e) { }
    return false;
}

export const extractInsights = (json: string): RootNode => {
    return {
        children: getChildrenNodes(JSON.parse(json))
    };
}

export const convertSizeToString = (size: number): string => {
    if (size === 0) {
        return '0';
    }
    if (size < 1024) {
        return size + ' B';
    }
    if (size < 1024 * 1024) {
        return (size / 1024).toFixed(2) + ' KB';
    }
    if (size < 1024 * 1024 * 1024) {
        return (size / 1024 / 1024).toFixed(2) + ' MB';
    }
    return size + ' B';
}

const getChildrenNodes = (o: any): ChildNode[] => {
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

const getNodePropertyInfo = (property: any): NodePropertyInfo => {
    if (property === null) {
        return {
            isObject: false,
            isArray: false,
            value: null
        };
    } else if (typeof property === "object") {
        if (Array.isArray(property)) {
            return {
                isObject: false,
                isArray: true,
                value: getChildrenNodes(property)
            };
        } else {
            return {
                isObject: true,
                isArray: false,
                value: getChildrenNodes(property)
            };
        }
    } else {
        return {
            isObject: false,
            isArray: false,
            value: property
        };
    }
}

const getNodeType = (isObject: boolean, isArray: boolean, value: null | boolean | number | string | ChildNode[]): string => {
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

const arrayOrObjectContainerSymbolLength = 2; // '[]' or '{}'

const calculateSize = (property: string, value: null | boolean | number | string | ChildNode[]): number => {
    if (value === null) {
        return `"${property}": null`.length;
    } else if (
        typeof value === "number" ||
        typeof value === "boolean") {
        return `"${property}": ${value.toString()}`.length;
    } else if (typeof value === "string") {
        return `"${property}": "${value.toString()}"`.length;
    } else if (typeof value === "object") {
        if (Array.isArray(value)) {
            const childrenSize = value
                .map(node => node.size)
                .reduce((a, b) => a + b, 0);

            return `"${property}": `.length + arrayOrObjectContainerSymbolLength + childrenSize;
        }
    }

    return 0;
}