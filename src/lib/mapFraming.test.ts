import { describe, expect, it } from 'vitest'
import { isInView, panIntoView } from './mapFraming'

const size = { width: 400, height: 300 }
const inset = { top: 70, right: 20, bottom: 40, left: 20 }

describe('panIntoView', () => {
  it('leaves a point that is already inside the box alone', () => {
    expect(panIntoView({ x: 200, y: 150 }, size, inset)).toEqual([0, 0])
  })

  it('pans only as far as the nearest edge of the box', () => {
    // 30px past the right inset and 10px into the top one.
    expect(panIntoView({ x: 410, y: 60 }, size, inset)).toEqual([30, -10])
    expect(panIntoView({ x: -5, y: 290 }, size, inset)).toEqual([-25, 30])
  })

  it('centres on an axis the insets do not fit in, instead of crossing the bounds', () => {
    const short = { width: 400, height: 100 }
    expect(panIntoView({ x: 200, y: 10 }, short, inset)).toEqual([0, -40])
  })
})

describe('isInView', () => {
  it('counts the edges as inside and anything past them as out', () => {
    expect(isInView({ x: 0, y: 300 }, size)).toBe(true)
    expect(isInView({ x: 401, y: 10 }, size)).toBe(false)
  })

  it('treats a collapsed map as showing nothing', () => {
    expect(isInView({ x: 0, y: 0 }, { width: 0, height: 300 })).toBe(false)
  })
})
