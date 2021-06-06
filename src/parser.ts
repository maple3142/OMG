const tryDecodeURIComponent = (s: string) => {
	try {
		return decodeURIComponent(s)
	} catch (e) {
		return s
	}
}

const tryParseNum = (num: string) => {
	const n = Number(num)
	return isNaN(n) ? num : n
}

export class ParseError extends Error {
	error: Error
	constructor(message: string, error: Error) {
		super()
		this.message = message
		this.error = error
	}
}

// modified from https://github.com/maple3142/osuplayer/blob/master/src/main/parser.js
class OSUParser {
	obj: any
	mode: string
	constructor() {
		this.obj = {}
		this.mode = ''
	}
	consume(line: string) {
		if (/^\[\w+\]$/.test(line)) {
			// match [Difficulty] [Metadata]...
			this.mode = /^\[(\w+)\]$/.exec(line)![1]
			// ignore Events
			this.obj[this.mode] = {}
			if (this.mode == 'HitObjects') {
				this.obj.HitObjects = []
			}
		} else if (this.mode === 'HitObjects') {
            // modified from ManiaFX
            if(this.obj.General.Mode !== 3){
                // Not mania map
                return true
            }
            const keyCount = this.obj.Difficulty.CircleSize
			// no be
			const tokens = line.split(':')[0].split(',')
			if (tokens.length < 4) return false
			const x = parseInt(tokens[0])
			const lane = Math.floor((x * keyCount) / 512)
			const start = parseInt(tokens[2])
			const type = parseInt(tokens[3])
			const isShort = (type & 1) != 0
			const isLong = (type & (1 << 7)) != 0
			if (isShort) {
				this.obj.HitObjects.push({ start, lane })
			} else if (isLong && tokens.length >= 6) {
				const end = parseInt(tokens[5])
				this.obj.HitObjects.push({ start, end, lane })
			}
			return false
		} else if (line.includes(':')) {
			const [k, v] = line.split(':').map(chk => chk.trim())
			this.obj[this.mode][k] = tryParseNum(v)
		} else if (this.mode === 'Events' && line.startsWith('0,0,"')) {
			// get bg file and break
			this.obj.General.BackgroundFilename = JSON.parse(line.split(',')[2])
		}
		return false
		// return false means not complete
	}
	postProcess() {
		if (typeof this.obj.Metadata.Title === 'number') {
			this.obj.Metadata.Title = this.obj.Metadata.Title.toString()
		}
		if (!this.obj.Metadata.TitleUnicode) {
			this.obj.Metadata.TitleUnicode = ''
		} else {
			this.obj.Metadata.TitleUnicode = this.obj.Metadata.TitleUnicode.toString()
		}
		if (!this.obj.Metadata.ArtistUnicode) {
			this.obj.Metadata.ArtistUnicode = ''
		} else {
			this.obj.Metadata.ArtistUnicode = this.obj.Metadata.ArtistUnicode.toString()
		}
		if (typeof this.obj.Metadata.Tags === 'string') {
			this.obj.Metadata.Tags = this.obj.Metadata.Tags.split('s')
				.filter((s: string) => s)
				.map((chk: string) => chk.trim())
		}
		if (this.obj.General.AudioFilename) {
			this.obj.General.AudioFilename = tryDecodeURIComponent(this.obj.General.AudioFilename)
		}
		if (this.obj.General.BackgroundFilename) {
			this.obj.General.BackgroundFilename = tryDecodeURIComponent(this.obj.General.BackgroundFilename)
		}
	}
	get() {
		return this.obj
	}
}
export const parseBeatmap = (s: string) => {
	const parser = new OSUParser()
	for (const line of s.split(/\r?\n/)) {
		try {
			const end = parser.consume(line)
			if (end) {
				break
			}
		} catch (e) {
			throw new ParseError(line, e)
		}
	}
    parser.postProcess()
	return parser.get()
}
