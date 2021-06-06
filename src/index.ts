import * as PIXI from 'pixi.js'
import { cachedCreateObjectURL, mod, SizeHandler, swapContainer } from './utils'
import { gamingStage, Beatmap, resultStage } from './game'
import { configure, ZipReader, BlobReader, BlobWriter, TextWriter } from '@zip.js/zip.js'
import { parseBeatmap } from './parser'

configure({
	useWebWorkers: true
})

const size = new SizeHandler()
const app = new PIXI.Application({ width: size.width, height: size.height, backgroundColor: 0x0 })
document.body.append(app.view)
app.view.focus()

const DIFF_ITEM_HEIGHT = 80
const createDiffucultyButton = (diffName: string) => {
	const ct = new PIXI.Container()
	const diff = new PIXI.Text(diffName, { fill: 0x000000 })
	const bound = new PIXI.Graphics()
	bound.beginFill(0xffffff, 0.5)
	bound.lineStyle(1, 0x000000)
	bound.drawRect(0, 0, 800, DIFF_ITEM_HEIGHT)
	ct.addChild(bound)
	ct.addChild(diff)
	ct.interactive = true
	ct.buttonMode = true
	return ct
}
const createSongMenu = () => {
	const songMenu = new PIXI.Container()
	const bgSprite = new PIXI.Sprite()
	bgSprite.width = size.width
	bgSprite.height = size.height
	songMenu.addChild(bgSprite)
	const difficultyMenu = new PIXI.Container()
	songMenu.addChild(difficultyMenu)
	return { songMenu, difficultyMenu, bgSprite }
}
const createButtonFromTexture = (texture: PIXI.Texture<PIXI.Resource> | undefined, btnSize: number) => {
	const btn = new PIXI.Sprite(texture)
	btn.width = btnSize
	btn.height = btnSize
	btn.interactive = true
	btn.buttonMode = true
	return btn
}
const mainMenu = new PIXI.Container()
const loadingText = new PIXI.Text('Loading...', { fill: 0xffffff })
loadingText.x = size.center_x - loadingText.width / 2
loadingText.y = size.center_y - loadingText.height / 2
mainMenu.addChild(loadingText)
app.stage.addChild(mainMenu)

const menuOverlay = new PIXI.Container()
menuOverlay.zIndex = 100
mainMenu.addChild(menuOverlay)

const showDialog = (container: PIXI.Container, titleStr: string, msgStr: string) => {
	const H_PAD = 20
	const V_PAD = 30
	const TITLE_PAD = 10
	const CONTENT_PAD = 20

	const title = new PIXI.Text(titleStr, { fill: 0x000000, fontSize: 40, fontWeight: 'bold' })
	title.x = H_PAD
	title.y = V_PAD

	const content = new PIXI.Text(msgStr, { fill: 0x000000 })
	content.x = H_PAD
	content.y = title.y + title.height + TITLE_PAD

	const width = Math.max(title.width, content.width) + 2 * H_PAD

	const closeBtn = new PIXI.Text('Close', { fill: 0x000000, fontWeight: 'bold' })
	closeBtn.interactive = true
	closeBtn.buttonMode = true
	closeBtn.x = width / 2 - closeBtn.width / 2
	closeBtn.y = content.y + content.height + CONTENT_PAD

	const height = title.height + TITLE_PAD + content.height + CONTENT_PAD + closeBtn.height + 2 * V_PAD

	const bg = new PIXI.Graphics()
	bg.beginFill(0xffffff, 0.8)
	bg.drawRoundedRect(0, 0, width, height, 15)

	const wrapper = new PIXI.Container()
	wrapper.addChild(bg)
	wrapper.addChild(title)
	wrapper.addChild(content)
	wrapper.addChild(closeBtn)
	;(closeBtn as any).on('click', () => {
		container.removeChild(wrapper)
	})

	wrapper.x = size.center_x - wrapper.width / 2
	wrapper.y = size.center_y - wrapper.height / 2

	container.addChild(wrapper)
}

const HELP_MESSAGE = `Use the pager to switch songs, and select a diffuculty to start playing.

When a note touches the green ring, 
you need to press "t", "i", "v", "m" according to its position.

Using the "+" button at top left,
you can import osu! mania 4k beatmaps. (.osz)`

const init = async () => {
	const data = await fetch('/data.json').then(r => r.json())
	const songMenus: PIXI.Container[] = []

	const addSong = async (blob: Blob) => {
		const { songMenu, difficultyMenu, bgSprite } = createSongMenu()
		songMenus.push(songMenu)
		const reader = new ZipReader(new BlobReader(blob))
		const entries = await reader.getEntries()
		const beatmaps: Beatmap[] = []
		const fileCache = new Map<string, Blob>()
		for (const file of entries.filter(e => e.filename.endsWith('.osu'))) {
			const ct = await file.getData!(new TextWriter())
			const data = parseBeatmap(ct)
			if (data.Difficulty.CircleSize == 4) {
				// only 4k are currently supported
				const afn = data.General.AudioFilename
				const audioBlob = fileCache.has(afn)
					? fileCache.get(afn)
					: await entries.find(e => e.filename === afn)?.getData!(new BlobWriter())
				fileCache.set(afn, audioBlob)
				const bfn = data.General.BackgroundFilename
				const bgBlob = fileCache.has(bfn)
					? fileCache.get(bfn)
					: await entries.find(e => e.filename === bfn)?.getData!(new BlobWriter())
				fileCache.set(bfn, bgBlob)
				beatmaps.push({
					title: `${data.Metadata.Title} [${data.Metadata.Version}]`,
					notes: data.HitObjects,
					song: audioBlob,
					bgTexture: PIXI.Texture.from(cachedCreateObjectURL(bgBlob))
				})
			}
		}
		const found = beatmaps.find(x => x.bgTexture)
		if (found) {
			bgSprite.texture = found.bgTexture
		}
		for (const [i, beatmap] of beatmaps.entries()) {
			const btn = createDiffucultyButton(beatmap.title)
			;(btn as any).on('click', () => {
				const { container: gameContainer, done } = gamingStage(size, beatmap)
				swapContainer(app.stage, mainMenu, gameContainer)
				done.then(result => {
					// game done: gameContainer -> resultContainer
					console.log(result)
					const { container: resultContainer, done } = resultStage(size, beatmap, result)
					swapContainer(app.stage, gameContainer, resultContainer)
					done.then(() => {
						// result screen back to menu: resultContainer -> mainMenu
						swapContainer(app.stage, resultContainer, mainMenu)
					})
				})
			})
			btn.y = DIFF_ITEM_HEIGHT * i
			difficultyMenu.addChild(btn)
		}
	}

	for (const map of data.default_maps) {
		const blob = await fetch(map).then(r => r.blob())
		await addSong(blob)
	}

	const switchPage = (next: number, prev: number) => {
		swapContainer(mainMenu, songMenus[prev], songMenus[next])
		mainMenu.sortChildren() // so that buttons will be at top
	}

	const BTN_SIZE = 128
	let currentPage = 0
	const leftBtn = createButtonFromTexture(app.loader.resources['assets/left.png'].texture, BTN_SIZE)
	leftBtn.y = size.height - BTN_SIZE
	menuOverlay.addChild(leftBtn)
	const rightBtn = createButtonFromTexture(app.loader.resources['assets/right.png'].texture, BTN_SIZE)
	rightBtn.y = size.height - BTN_SIZE
	rightBtn.x = size.width - BTN_SIZE
	menuOverlay.addChild(rightBtn)
	;(leftBtn as any).on('click', () => {
		const nextPage = mod(currentPage - 1, songMenus.length)
		switchPage(nextPage, currentPage)
		currentPage = nextPage
	})
	;(rightBtn as any).on('click', () => {
		const nextPage = mod(currentPage + 1, songMenus.length)
		switchPage(nextPage, currentPage)
		currentPage = nextPage
	})
	switchPage(0, 0) // set page

	const HELP_SIZE = 100
	const helpBtn = new PIXI.Text('?', { fill: 0x000000, fontSize: HELP_SIZE })
	helpBtn.x = size.center_x - helpBtn.width / 2
	helpBtn.y = size.height - (BTN_SIZE - HELP_SIZE) / 2 - HELP_SIZE
	helpBtn.interactive = true
	helpBtn.buttonMode = true
	;(helpBtn as any).on('click', () => {
		showDialog(menuOverlay, 'Help', HELP_MESSAGE)
	})
	menuOverlay.addChild(helpBtn)

	const selectFile = (fileEl: HTMLInputElement) => <Promise<File>>new Promise((resolve, reject) => {
			fileEl.onchange = e => {
				if (fileEl.files!.length >= 1) {
					resolve(fileEl.files!.item(0)!)
				} else {
					reject()
				}
			}
			fileEl.click()
		})
	const addBtn = createButtonFromTexture(app.loader.resources['assets/plus.png'].texture, BTN_SIZE)
	addBtn.x = size.width - BTN_SIZE
	;(addBtn as any).on('click', () => {
		selectFile(document.getElementById('file') as HTMLInputElement)
			.then(addSong)
			.then(() => switchPage(songMenus.length - 1, currentPage))
	})
	menuOverlay.addChild(addBtn)
}

app.loader.add('assets/left.png').add('assets/right.png').add('assets/plus.png').load(init)

// prevent misclick or mispress
window.addEventListener('contextmenu', e => e.preventDefault())
