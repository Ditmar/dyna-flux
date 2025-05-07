import { ManagerEnvsGraph } from "./ManagerEnvsGraph";

const getBaseCodeBlock = (codeString: string) => {
    const firstIndex = codeString.indexOf('{');
    const lastIndex = codeString.lastIndexOf('}');
    return codeString.substring(firstIndex, lastIndex + 1);
}
// search if the htmlcode exits in this format
// <div id='plotly-1' class='plotly' data-plotly='data'></div>
const getPlotlyCodeBlock = (html: string) => {
    const expression = /<div\s+id=['\"].+['\"]\s+class=['\"]plotly['\"][^>]*>.*?<\/div>/g;
    const matches = html.match(expression);
    if (matches) {
        return matches.map(extractPlotlyAttributes);
    }
    return null;
}

const initPlotly = (html: string) => {
    ManagerEnvsGraph.updateVarsGraph(html);
    const plotlyObjects = getPlotlyCodeBlock(html);
    let code = ``;
    if (plotlyObjects) {
        plotlyObjects.forEach((plotlyObject: any) => {
            const { id } = plotlyObject;
            code += `const ${id.replace('-', '_')} = document.getElementById('${id}');`
        });
    }
    return code;
}

const detectBlockIndices = (code: string, functionName: string) => {
    const functionRegex = new RegExp(`${functionName}\\s*:\\s*(function\\s*\(.*\)|\(.*\)\\s*=>)\\s*{`);
    let startIndex = code.search(functionRegex);
    const endIndex = code.length;
    const subStartIndex = code.substring(startIndex, endIndex).indexOf('{');
    startIndex = startIndex + subStartIndex + 1;
    return { startIndex, endIndex };
}

const getEnvsInitGraphs = (html: string) => {
    const envs = ManagerEnvsGraph.getEnvs();
    let code = ``;
    envs.forEach((value, key) => {
        code += `this.${key} = ${value};`;
    });
    return code;
}

const getVarsGraph = (dataPlotly: string) => {
    const data = dataPlotly.match(/[\w\-]+\s*\,\s*[\w\-]+\,*\s*[\w\-]*/g);
    if (data) {
        return data.map((d: string) => {
            let cleanVars = d.trim();
            cleanVars = cleanVars.replace(/[\[\]']+/g, '');
            return cleanVars.split(',').map((d: string) => d.trim());
        });
    } else {
        throw Error('Error in data-plotly attribute, plese use the format [key, value]');
    }
}

const renderInitPlotyData = (html: string) => {
    const plotlyObjects = getPlotlyCodeBlock(html);
    const hashMap = new Map<string, boolean>();
    const code = ['', '', ''];
    if (plotlyObjects) {
        console.log('plotlyObjects', plotlyObjects);
        plotlyObjects.forEach((plotlyObject: any) => {
            const { id, dataPlotly } = plotlyObject;
            const plotData = getVarsGraph(dataPlotly);
            code[2] += `const dataPlotly_${id} = []; \n`;
            for (let i = 0; i < plotData.length; i++) {
                const [x, y, z] = plotData[i];
                if (x === undefined || y === undefined) {
                    throw Error('Error in data-plotly attribute, plese use the format [key, value]');
                }
                if (z !== undefined) {
                    if (!hashMap.has(`const ${x}_${id}PlotData = []; \n`)) {
                        code[0] += `const ${x}_${id}PlotData = []; \n`;
                        hashMap.set(`const ${x}_${id}PlotData = []; \n`, true);
                    }
                    if (!hashMap.has(`const ${y}_${id}PlotData = []; \n`)) {
                        code[0] += `const ${y}_${id}PlotData = []; \n`;
                        hashMap.set(`const ${y}_${id}PlotData = []; \n`, true);
                    }
                    if (!hashMap.has(`const ${z}_${id}PlotData = []; \n`)) {
                        code[0] += `const ${z}_${id}PlotData = []; \n`;
                        hashMap.set(`const ${z}_${id}PlotData = []; \n`, true);
                    }
                    if (!hashMap.has(`${x}_${id}PlotData.push(this.${x}); \n`)) {
                        code[1] += `${x}_${id}PlotData.push(this.${x}); \n`;
                        hashMap.set(`${x}_${id}PlotData.push(this.${x}); \n`, true);
                    }
                    if (!hashMap.has(`${y}_${id}PlotData.push(this.${y}); \n`)) {
                        code[1] += `${y}_${id}PlotData.push(this.${y}); \n`;
                        hashMap.set(`${y}_${id}PlotData.push(this.${y}); \n`, true);
                    }
                    if (!hashMap.has(`${z}_${id}PlotData.push(this.${z}); \n`)) {
                        code[1] += `${z}_${id}PlotData.push(this.${z}); \n`;
                        hashMap.set(`${z}_${id}PlotData.push(this.${z}); \n`, true);
                    }
                    code[2] += `dataPlotly_${id}.push({x: ${x}_${id}PlotData, y: ${y}_${id}PlotData, z: ${z}_${id}PlotData, mode: 'lines', type: 'scatter3d'}) \n`;
                    code[2] += ``;
                } else {
                    if (!hashMap.has(`const ${x}_${id}PlotData = []; \n`)) {
                        code[0] += `const ${x}_${id}PlotData = []; \n`;
                        hashMap.set(`const ${x}_${id}PlotData = []; \n`, true);
                    }
                    if (!hashMap.has(`const ${y}_${id}PlotData = []; \n`)) {
                        code[0] += `const ${y}_${id}PlotData = []; \n`;
                        hashMap.set(`const ${y}_${id}PlotData = []; \n`, true);
                    }
                    if (!hashMap.has(`${x}_${id}PlotData.push(this.${x}); \n`)) {
                        code[1] += `${x}_${id}PlotData.push(this.${x}); \n`;
                        hashMap.set(`${x}_${id}PlotData.push(this.${x}); \n`, true);
                    }
                    if (!hashMap.has(`${y}_${id}PlotData.push(this.${y}); \n`)) {
                        code[1] += `${y}_${id}PlotData.push(this.${y}); \n`;
                        hashMap.set(`${y}_${id}PlotData.push(this.${y}); \n`, true);
                    }

                    code[2] += `dataPlotly_${id}.push({x: ${x}_${id}PlotData, y: ${y}_${id}PlotData, mode: 'lines', type: 'scatter'}); \n`;
                }

            }
            console.log('----------------->', id);
            code[2] += `Plotly.react('${id}', dataPlotly_${id}, {}); \n`;
        });
    }
    console.log('code', code);
    return code;
}

const extractPlotlyAttributes = (htmlString: string) => {
    const regex = /<div\s+([^>]+)>/i;
    const match = htmlString.match(regex);

    if (!match) return null;

    const attributesString = match[1];

    const attrRegex = /([\w-:]+)\s*=\s*['"]([^'"]*)['"]/g;
    const attributes: Record<string, string> = {};

    let attrMatch;
    while ((attrMatch = attrRegex.exec(attributesString)) !== null) {
        const attrName = convertDashToCamel(attrMatch[1])
        const attrValue = attrMatch[2];
        attributes[attrName] = attrValue;
    }

    return attributes;
};

const convertDashToCamel = (str: string) => {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}


export { getBaseCodeBlock, getPlotlyCodeBlock, initPlotly, getVarsGraph, getEnvsInitGraphs, renderInitPlotyData, detectBlockIndices };