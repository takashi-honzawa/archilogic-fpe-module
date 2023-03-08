import { Point2d, pointInPolygon, polygonBounds } from '@archilogic/scene-structure'

const MAX_SAMPLES = 10000

export const pointsFromSpace = (space, ppm = 10) => {
  const bounds = polygonBounds([space.boundary.shape])
  const dimX = bounds.length
  const dimY = bounds.width
  if (dimX * dimY * ppm * ppm > MAX_SAMPLES) {
    ppm = Math.sqrt(MAX_SAMPLES / (dimX * dimY))
  }
  // The pixel size of our image
  let width = Math.round(dimX * ppm)
  let height = Math.round(dimY * ppm)

  return gridPoints({ x: bounds.x, y: bounds.z, width, height, ppm })
}

export const gridPoints = ({ width, height, ppm, x, y }) => {
  const tileWidth = 1 / ppm
  let points = []
  let counter = 0
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const xPos = counter % width
      const yPos = Math.floor(counter / width)
      const point = [x + xPos / ppm + tileWidth / 2, y + yPos / ppm + tileWidth / 2]
      points[counter] = point
      counter++
    }
  }
  return points
}

export const sortGrid = points => {
  const sortedPoints = []
  let yVal,
    counter = 0
  points.forEach(p => {
    if (yVal && yVal !== p[1]) counter++
    yVal = p[1]
    sortedPoints[counter] = sortedPoints[counter] || []
    sortedPoints[counter].push(p)
  })
  return sortedPoints
}

export const getBinaryGrid = ({ points, polygon, holes, matrix = true }) => {
  let binaryGrid = []
  if (matrix) {
    points.forEach((row, i) => {
      binaryGrid[i] = []
      row.forEach((p, j) => {
        let isInPolygon = pointInPolygon(p, polygon)
        let isInHole = holes.some(hole => pointInPolygon(p, hole))
        binaryGrid[i][j] = isInPolygon && !isInHole ? 1 : 0
      })
    })
  } else {
    points = points.filter(p => {
      let isInPolygon = pointInPolygon(p, polygon)
      let isInHole = holes.some(hole => pointInPolygon(p, hole))
      return isInPolygon && !isInHole
    })
  }
  return binaryGrid
}
