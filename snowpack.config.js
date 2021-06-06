// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
	mount: {
		src: '/'
	},
	plugins: [],
	packageOptions: {},
	devOptions: {
		hmr: false
	},
	buildOptions: {},
	optimize: {
		bundle: true,
		minify: true,
		target: 'es2018'
	}
}
