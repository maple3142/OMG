import * as PIXI from 'pixi.js'
import { keyboardHelper, KeyEventHelper, SizeHandler } from './utils'

export interface GameConfig {
	ntime: number // time(ms) from center to outer circle
	lanes: number
}

export interface Note {
	start: number // ms
	end?: number // ms
	lane: number
}

interface NoteState extends Note {
	end: number
	g?: PIXI.Graphics
	pressed: boolean
	done: boolean
}

export interface Beatmap {
	title: string
	notes: Note[]
	song: Blob
	bgTexture: PIXI.Texture
}

interface ResultCounts {
	perfect: number
	great: number
	good: number
	miss: number
}

interface Result {
	score: number
	maxCombo: number
	counts: ResultCounts
}

// Only supports 4 lanes currently
const DIRECTIONS = [
	[0, 1],
	[-1, 0],
	[0, -1],
	[1, 0]
]
const MAX_DELAY = 150
const THRESHOLDS: { delay: number; score: number; color: number; displayName: string; name: keyof ResultCounts }[] = [
	{ delay: 50, score: 3, color: 0xffb10a, displayName: 'Perfect', name: 'perfect' },
	{ delay: 100, score: 2, color: 0xe022ca, displayName: 'Great', name: 'great' },
	{ delay: 150, score: 1, color: 0x2bc24b, displayName: 'Good', name: 'good' }
]
const KEYS = ['v', 't', 'i', 'm']
const BAR_WIDTH = 40
const DEFAULT_CONFIG: GameConfig = {
	lanes: 4,
	ntime: 500
}

export const gamingStage = (
	size: SizeHandler,
	{ song, notes, bgTexture }: Beatmap,
	{ lanes, ntime }: GameConfig = DEFAULT_CONFIG
) => {
	const outer = new PIXI.Container()
	outer.x = size.center_x
	outer.y = size.center_y
	const bgSprite = new PIXI.Sprite(bgTexture)
	bgSprite.x = -size.center_x
	bgSprite.y = -size.center_y
	bgSprite.width = size.width
	bgSprite.height = size.height
	bgSprite.alpha = 0.5
	outer.addChild(bgSprite)

	const inner = new PIXI.Container()
	inner.rotation = Math.PI / 4
	outer.addChild(inner)

	const outCircle = new PIXI.Graphics()
	outCircle.beginFill(0x04acf4)
	outCircle.drawCircle(0, 0, size.radius)
	inner.addChild(outCircle)

	const outCircleMask = new PIXI.Graphics()
	outCircleMask.beginFill(0x04acf4)
	outCircleMask.drawCircle(0, 0, size.radius)
	inner.addChild(outCircleMask)

	const drawBar = (g: PIXI.Graphics, color: number, y: number = 0) => {
		g.beginFill(color)
		g.drawRect(-BAR_WIDTH / 2, y, BAR_WIDTH, size.radius - y)
	}

	const LANE_ANGLE = (Math.PI * 2) / lanes
	const bars: PIXI.Graphics[] = []
	const barMasks: PIXI.Graphics[] = []
	for (let i = 0; i < lanes; i++) {
		const bar = new PIXI.Graphics()
		drawBar(bar, 0xffffff)
		bar.rotation = LANE_ANGLE * i
		inner.addChild(bar)
		bars.push(bar)

		const barMask = new PIXI.Graphics()
		barMask.beginFill(0xffffff)
		barMask.drawRect(-BAR_WIDTH / 2, 0, BAR_WIDTH, size.radius)
		barMask.rotation = LANE_ANGLE * i
		inner.addChild(barMask)
		barMasks.push(barMask)
	}
	bars[0].mask = outCircleMask

	const CIRCLE_LINE_RADIUS = (size.radius * 19) / 20
	const circleLine = new PIXI.Graphics()
	circleLine.lineStyle(10, 0x04d79c, 1)
	circleLine.drawCircle(0, 0, CIRCLE_LINE_RADIUS)
	circleLine.zIndex = 100
	inner.addChild(circleLine)

	const centerCircle = new PIXI.Graphics()
	centerCircle.beginFill(0x36aba9)
	centerCircle.drawCircle(0, 0, BAR_WIDTH / Math.sqrt(2))
	centerCircle.zIndex = 100
	inner.addChild(centerCircle)

	const drawNote = (g: PIXI.Graphics, note: NoteState, color: number) => {
		const noteLen = ((note.end - note.start) / ntime) * CIRCLE_LINE_RADIUS
		g.beginFill(color)
		g.drawRect(-BAR_WIDTH / 2, 0, BAR_WIDTH, noteLen)
	}

	const tipMsg = new PIXI.Text('', { fontSize: 40 })
	tipMsg.y = 300
	outer.addChild(tipMsg)
	let _tipMsgIt: number = 0
	const showTipMessage = (msg: string, color: number, delay: number = 1000) => {
		// Perfect, Great, Good, Miss
		clearTimeout(_tipMsgIt)
		tipMsg.text = msg
		tipMsg.style.fill = color
		tipMsg.x = -tipMsg.width / 2
		_tipMsgIt = setTimeout(() => {
			tipMsg.text = ''
		}, delay)
	}

	let maxCombo = 0
	let combo = 0
	const comboText = new PIXI.Text('0x', { fill: 0x000000, fontSize: 40 })
	comboText.x = -comboText.width / 2
	comboText.y = -300
	outer.addChild(comboText)
	const updateCombo = (newCombo: number) => {
		combo = newCombo
		comboText.text = `${combo}x`
		comboText.x = -comboText.width / 2
		if (combo > maxCombo) {
			maxCombo = combo
		}
	}

	let score = 0
	const scoreText = new PIXI.Text('0', { fill: 0x000000, fontSize: 40 })
	scoreText.x = -scoreText.width / 2
	scoreText.y = -300 + comboText.height
	outer.addChild(scoreText)
	const updateScore = (newScore: number) => {
		score = newScore
		scoreText.text = `${score}`
		scoreText.x = -scoreText.width / 2
	}

	const counts: ResultCounts = { perfect: 0, great: 0, good: 0, miss: 0 }

	const copiedNotes: NoteState[] = notes.map(note =>
		Object.assign({ pressed: false, done: false, end: note.start + 50 }, note)
	)
	const ticker = new PIXI.Ticker()
	const keyHelpers: KeyEventHelper[] = []

	const startGame = () => {
		for (const [lane, key] of KEYS.entries()) {
			const helper = keyboardHelper(key)
			helper.press = () => {
				drawBar(bars[lane], 0x0f1f54, CIRCLE_LINE_RADIUS)
				const time = audio.currentTime * 1000
				for (const note of copiedNotes) {
					if (note.lane == lane && Math.abs(time - note.start) <= MAX_DELAY && note.g) {
						note.g.clear()
						drawNote(note.g, note, 0x7b8185)
						note.pressed = true
					}
				}
			}
			helper.release = () => {
				drawBar(bars[lane], 0xffffff, CIRCLE_LINE_RADIUS)
				const time = audio.currentTime * 1000
				for (const note of copiedNotes) {
					if (note.lane == lane && note.pressed && note.g) {
						note.pressed = false
						let hit = false
						const delta = Math.abs(time - note.end)
						for (const { delay, score: noteScore, color, displayName, name } of THRESHOLDS) {
							if (delta <= delay) {
								note.g.clear()
								drawNote(note.g, note, 0x50ad5f)
								updateCombo(combo + 1)
								updateScore(score + noteScore * combo)
								counts[name]++
								showTipMessage(displayName, color)
								hit = true
								break
							}
						}
						if (!hit) {
							note.g.clear()
							drawNote(note.g, note, 0xad4745)
							updateCombo(0)
							counts.miss++
							showTipMessage('Miss', 0xe02319)
						}
						note.done = true
					}
				}
			}
			keyHelpers.push(helper)
		}
		ticker.add(() => {
			const time = audio.currentTime * 1000
			for (const note of copiedNotes) {
				if (time + ntime >= note.start && !note.g) {
					const g = new PIXI.Graphics()
					drawNote(g, note, 0xbbc4c9)
					g.rotation = LANE_ANGLE * note.lane
					g.mask = barMasks[note.lane]
					inner.addChild(g)
					note.g = g
				}
				if (note.g) {
					const timeBound = time - ntime / 20 // time of outer circle
					if (timeBound <= note.end) {
						const dir = DIRECTIONS[note.lane]
						const loc = ((ntime + time - note.end) / ntime) * CIRCLE_LINE_RADIUS
						note.g.x = dir[0] * loc
						note.g.y = dir[1] * loc
					} else {
						inner.removeChild(note.g)
					}
				}
				if (time - note.start >= MAX_DELAY && !note.pressed && !note.done && note.g) {
					// missed the note start
					note.g.clear()
					drawNote(note.g, note, 0xad4745)
					updateCombo(0)
					counts.miss++
					showTipMessage('Miss', 0xe02319)
					note.done = true
				}
			}
			inner.sortChildren() // update zIndex
		})
		ticker.start()
	}

	const audioUrl = URL.createObjectURL(song)
	const audio = new Audio(audioUrl)
	audio.onplay = startGame
	audio.play()

	const done: Promise<Result> = new Promise(resolve => {
		audio.onended = resolve
	}).then(() => {
		for (const k of keyHelpers) {
			k.unsubscribe()
		}
		ticker.stop()
		return { maxCombo, score, counts }
	})

	return { container: outer, done }
}

export const resultStage = (size: SizeHandler, beatmap: Beatmap, result: Result) => {
	const outer = new PIXI.Container()
	const bgSprite = new PIXI.Sprite(beatmap.bgTexture)
	bgSprite.width = size.width
	bgSprite.height = size.height
	bgSprite.alpha = 0.5
	outer.addChild(bgSprite)

	const inner = new PIXI.Container()
	const titleText = new PIXI.Text(beatmap.title, { fill: 0xffffff })
	inner.addChild(titleText)

	const list = new PIXI.Container()
	list.y = titleText.height + 80
	inner.addChild(list)

	const components = [
		new PIXI.Text(`Perfect: ${result.counts.perfect}`, { fill: 0xffffff }),
		new PIXI.Text(`Great: ${result.counts.great}`, { fill: 0xffffff }),
		new PIXI.Text(`Good: ${result.counts.good}`, { fill: 0xffffff }),
		new PIXI.Text(`Miss: ${result.counts.miss}`, { fill: 0xffffff }),
		new PIXI.Text(`Score: ${result.score}`, { fill: 0xffffff }),
		new PIXI.Text(`Max Combo: ${result.maxCombo}`, { fill: 0xffffff })
	]
	let lastComp = { y: 0, height: 0 }
	for (const comp of components) {
		comp.y = lastComp.y + lastComp.height
		list.addChild(comp)
		lastComp = comp
	}

	const backBtn = new PIXI.Text('Back To Menu', { fill: 0xffffff, fontWeight: 'bold' })
	backBtn.interactive = true
	backBtn.buttonMode = true
	backBtn.x = inner.width / 2 - backBtn.width / 2
	backBtn.y = list.y + list.height + 40
	inner.addChild(backBtn)
	const done = new Promise(resolve => {
		;(backBtn as any).on('click', resolve)
	})

	inner.x = size.center_x - inner.width / 2
	inner.y = size.center_y - inner.height / 2
	outer.addChild(inner)

	return { container: outer, done }
}
