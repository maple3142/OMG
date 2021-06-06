// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
	mount: {
		src: '/'
	},
	plugins: [],
	packageOptions: {
		polyfillNode: true
	},
	devOptions: {
		hmr: false
	},
	buildOptions: {},
	optimize: {
		bundle: true,
		minify: true,
		target: 'es2020'
	}
}
