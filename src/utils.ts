import * as PIXI from 'pixi.js'

export class SizeHandler {
	public width!: number
	public height!: number
	public center_x!: number
	public center_y!: number
	public radius!: number
	constructor() {
		this.update()
		window.addEventListener('resize', this.update.bind(this))
	}
	update() {
		this.width = window.innerWidth
		this.height = window.innerHeight
		this.center_x = this.width / 2
		this.center_y = this.height / 2
		this.radius = Math.min(this.center_x, this.center_y)
	}
}
export interface KeyEventHelper {
	value: string
	isDown: boolean
	isUp: boolean
	press(key: KeyEventHelper, event: KeyboardEvent): void
	release(key: KeyEventHelper, event: KeyboardEvent): void
	unsubscribe(): void
}
export function keyboardHelper(value: string): KeyEventHelper {
	// modified from https://github.com/kittykatattack/learningPixi#keyboard-movement
	const key: KeyEventHelper = {
		value,
		isDown: false,
		isUp: true,
		press: () => {},
		release: () => {},
		unsubscribe: () => {}
	}
	const downHandler = (event: KeyboardEvent) => {
		if (event.key === key.value) {
			if (key.isUp && key.press) key.press(key, event)
			key.isDown = true
			key.isUp = false
			event.preventDefault()
		}
	}

	const upHandler = (event: KeyboardEvent) => {
		if (event.key === key.value) {
			if (key.isDown && key.release) key.release(key, event)
			key.isDown = false
			key.isUp = true
			event.preventDefault()
		}
	}

	window.addEventListener('keydown', downHandler, false)
	window.addEventListener('keyup', upHandler, false)

	key.unsubscribe = () => {
		window.removeEventListener('keydown', downHandler)
		window.removeEventListener('keyup', upHandler)
	}

	return key
}
export const mod = (a: number, b: number) => ((a % b) + b) % b // actual euclidean modulo
export const cacheUnaryFunction = <T, U>(f: (x: T) => U) => {
	const cache = new Map<T, U>()
	return (x: T) => {
		if (cache.has(x)) return cache.get(x)! // https://github.com/microsoft/TypeScript/issues/13086
        const r = f(x)
		cache.set(x, r)
		return r
	}
}
export const cachedCreateObjectURL = cacheUnaryFunction(URL.createObjectURL)
export const swapContainer = (parent: PIXI.Container, prev: PIXI.Container, next: PIXI.Container)=>{
    parent.removeChild(prev)
    parent.addChild(next)
}
