import { astar, Graph } from 'javascript-astar'
import { polygonOffset } from '@archilogic/scene-structure'
import { cloneDeep } from 'lodash'
import { getBinaryGrid, pointsFromSpace, sortGrid } from './sample-grid'

// worth checking: https://www.david-gouveia.com/pathfinding-on-a-2d-polygonal-map

export function getPath({ space, options }) {
  let points = pointsFromSpace(space)
  options = options || {}
  const startPoint = options.startPoint
  const endPoint = options.endPoint
  const polygon = space.boundary.shape

  // find interiors that block circulation
  const blockingInteriors =
    space.elements?.interiors.filter(
      el =>
        el.product.categories.includes('storage') ||
        el.product.categories.includes('tables') ||
        (el.product.boundingPoints.max[1] > 1.5 &&
          !el.product.categories.includes('seating') &&
          !el.product.categories.includes('relaxing') &&
          !el.product.tags.includes('person') &&
          !el.product.isCeilingLamp)
    ) || []

  space.holes = space.holes || []
  let holes = [...space.holes, ...blockingInteriors.map(el => el.shape)]
  const gridSize = Math.abs(points[0][0] - points[1][0])
  // shrink the space to make sure thin walls are captured
  const growMargin = gridSize > 0.5 ? 0.3 : 0.15
  let _polygon = polygonOffset([cloneDeep(polygon)], -growMargin)[0]
  let _holes = holes.map(hole => polygonOffset([cloneDeep(hole)], growMargin)[0]).filter(h => h)

  points = sortGrid(points)
  const binaryGrid = getBinaryGrid({ polygon: _polygon, holes: _holes, points })

  let startPos = findClosestTile(startPoint, points, binaryGrid)
  let endPos = findClosestTile(endPoint, points, binaryGrid)

  const result = findPath(binaryGrid, startPos, endPos)
  let path = []
  result.forEach(r => {
    binaryGrid[r.x][r.y] += 2
    path.push(points[r.x][r.y])
  })
  // result is an array containing the shortest path
  let pointValues = binaryGrid.reduce((total, amount) => {
    return total.concat(amount)
  }, [])
  return { pointValues, shapes: [path] }
}

function findPath(grid, startPos, endPos, diagonal = true) {
  diagonal = !!diagonal
  var graph = new Graph(grid, { diagonal })
  var start = graph.grid[startPos[0]][startPos[1]]
  var end = graph.grid[endPos[0]][endPos[1]]
  var result = astar.search(graph, start, end, { heuristic: astar.heuristics.diagonal })
  return result
}

function findClosestTile(point, points, binaryGrid) {
  let d = Infinity,
    bestMatch = []
  for (var i = 0; i < points.length; i++) {
    for (var j = 0; j < points[0].length; j++) {
      if (!binaryGrid[i][j]) continue
      let _p = points[i][j]
      let _d = distance(point, _p)
      // console.log(_d)
      if (_d < d) {
        bestMatch = [i, j]
        d = _d
      }
    }
  }
  return bestMatch
}

function distance(p, q) {
  let d = [q[0] - p[0], q[1] - p[1]]
  return Math.sqrt(d[0] * d[0] + d[1] * d[1])
}
