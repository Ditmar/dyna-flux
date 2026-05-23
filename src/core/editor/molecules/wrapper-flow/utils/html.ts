import { detectBlockIndices } from './parsecode';

const getWrapperHead = (title: string, model: string, options: string) => {
    return `
    <!DOCTYPE html>
        <html>
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
            <base target="_top">
            <title>${title}</title>
            <!-- stylesheets -->
            <link href='http://fonts.googleapis.com/css?family=Lato' rel='stylesheet' type='text/css'>
            <link rel="stylesheet" href="./fonts/Insolent/stylesheet.css" type="text/css">
            <link rel="stylesheet" href="./fonts/BorisBlackBloxx/stylesheet.css" type="text/css">
            <link rel="stylesheet" href="./style.css" type="text/css">
            <!-- third party libraries -->
            <script src="https://cdn.plot.ly/plotly-3.0.0.min.js" charset="utf-8"></script>
            <!-- Tangle -->
            <script type="text/javascript" src="./lib/TangleKit/Tangle.js"></script>

            <!-- TangleKit -->
            <link rel="stylesheet" href="./lib/TangleKit/TangleKit.css" type="text/css">
            <script type="text/javascript" src="./lib/TangleKit/mootools.js"></script>
            <script type="text/javascript" src="./lib/TangleKit/sprintf.js"></script>
            <script type="text/javascript" src="./lib/TangleKit/BVTouchable.js"></script>
            <script type="text/javascript" src="./lib/TangleKit/TangleKit.js"></script>
            <script type="text/javascript" src="./lib/dynaflux-stdlib.js"></script>
            ${getWrapperTangle(model, options)}
        </head>
    `;
}

const getWrapperTangle = (model: string, options: string = '') => {
    detectBlockIndices(model, 'update');

    return `
    	<script type="text/javascript">
        ${options}
		function setUpTangle () {
			var element = document.getElementById("example");
			if (!element) return;
			var tangle = new Tangle(element, ${model});
		}

	</script>
    `
}

const getWrapperBody = (bodyHtml: string) => {
    return `
        <body onload="setUpTangle();">
        ${bodyHtml}
    </body>
    `
}

export { getWrapperHead, getWrapperBody };