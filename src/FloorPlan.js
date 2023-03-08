import React, { useEffect, useRef } from 'react';
//import 'fake-indexeddb/auto'
//import { FloorPlanEngine } from '@archilogic/floor-plan-webgl'
import { FloorPlanEngine } from '@archilogic/floor-plan-sdk'
import './FloorPlan.css'

// import { getMergedSpace, polygonPerimeter, Shape } from '@archilogic/scene-structure'
// import { getPath } from './analysis/pathfinding'

import Flatten from '@flatten-js/core';
const { Point } = Flatten;

function clamp(input, min, max) {
  return input < min ? min : input > max ? max : input
}
function map(current, in_min, in_max, out_min, out_max) {
  const mapped = ((current - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min
  return clamp(mapped, out_min, out_max)
}

function findMinMax(spaceData) {
  let max = -Infinity;
  let min = Infinity;
  for (let i = 0; i < spaceData.length; i++) {
    let current = spaceData[i];
    if (current.value > max) {
      max = current.value;
    }
    if (current.value < min) {
      min = current.value;
    }
  }
  return { max, min };
}

let spaceColorObjects = []

let defaultColors = {
  work: [0, 122, 255], 
  meet: [196, 0, 150],
  socialize: [255, 171, 0],
  support: [12, 24, 41],
  care: [189, 215, 255],
  circulate: [84, 192, 114],
  void: [255, 255, 255],
  other: [255, 255, 255]
}

let spaceData
let midPoints = 10
let minColor
let maxColor
let outMin = 0
let outMax = midPoints - 1

function convertRGBStringToArray(rgbString) {
  return rgbString
    .replace(/rgb\(|\)/g, "")
    .split(",")
    .map(function(item) {
      return parseInt(item.trim(), 10);
    });
}
function valueToHex(c) {
  var hex = c.toString(16)
  return hex
}
function rgbToHex(rgbArray) {
  return valueToHex(rgbArray[0]) + valueToHex(rgbArray[1]) + valueToHex(rgbArray[2])
}
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null
}
function initializeGradients(minColor, maxColor) {
  const rgbMin = convertRGBStringToArray(minColor)
  const rgbMax = convertRGBStringToArray(maxColor)
  const hexMin = rgbToHex(rgbMin)
  const hexMax = rgbToHex(rgbMax)
  const gradientColors = new JSGradient([`#${hexMin}`, `#${hexMax}`], midPoints);
  return gradientColors
}

function arrayEquals(array1, array2){
  if (JSON.stringify(array1) === JSON.stringify(array2)){
    return true
  } else {
    return false
  }
}

const startupSettings = {
  //planRotation: 90, 
  ui: { menu: false, scale: false },
  theme: {
    elements: {
      asset: {
         fillOpacity: 0.8,
      },
      roomStamp: {
        roomStampDisplay: ['usage']
      },
    },
    background: {
      color: '#ffffff',//'transparent',
      showGrid: false,
    },
  },
  units: {
    system: "imperial"
  }
}

let token
let floorId
let hasLoaded = false
let fpe
let highlightedIds = []
let prevClickedSpaceId
let cursorMarker
let nearestMarkers = []

let nearestDistances = {
  meetingRoom: 0.0,
  socializeSpace: 0.0,
  restroom: 0.0,
  storage: 0.0,
  elevator: 0.0,
  staircase: 0.0,
  aed: 0.0,
  emergencyExit: 0.0,
  fireHose: 0.0,
  fireAlarm: 0.0,
  extinguisher: 0.0,
  sanitizer: 0.0,
}

const FloorPlan = ({ triggerQuery, model, modelUpdate }) => {
  const container = useRef(null);

  console.log('model', model)
  const { token, floorId } = model
  //const token = "93c44a45-86a4-47c3-8a67-2d4be0fb0753" //"c6580a08-797b-4f88-ba7c-6c3db7dd7e2c"
  //const floorId = "afb8a0bc-eb37-4729-a72c-5b2637813398" //Allianze"b46e58e8-c45d-4fcd-b925-e7c4cc655715" //"45007690-d201-45f1-a403-f64de8ac6abc" 

  function addMarker(fpe, position, isIconMarker, markerType = 'defalut-marker') {
    const el = document.createElement('div');
    el.className =  isIconMarker ? "icon-marker" : "marker"
    el.classList.add(markerType)

    const marker = fpe.addHtmlMarker({
      el,
      pos: position,
      offset: [0, 0],
      radius: false,
    });
    return marker;
  }
  function getDistance(p1, p2) {
    let x = p2.x - p1.x;
    let y = p2.y - p1.y;
    return Math.sqrt(x * x + y * y);
  }
  function removeCursorMarker(){
    if (cursorMarker){
      cursorMarker.remove();
    }
  }
  function removeNearestMarkers(){
    if (nearestMarkers.length !== 0){
      nearestMarkers.forEach(marker => marker.remove())
      nearestMarkers = [];
    }
  }
  function createSpaceColorObjects(spaceResources) {
    createDefaultColors(spaceResources)
  }
  function createDefaultColors(spaceResources){
    spaceColorObjects = []
    spaceResources.forEach(space => {
      if ( space.program ) {
        const color = defaultColors[space.program]
        const spaceColorObject = {
          space,
          displayData: { value: null, gradientIndex: null, color: color }
        }
        spaceColorObject.space.node.setHighlight({
          fill: color,
          fillOpacity: 0.4
        })
        spaceColorObjects.push(spaceColorObject)
      } else {
        const color = defaultColors['other']
        const spaceColorObject = {
          space,
          displayData: { value: null, gradientIndex: null, color: color }
        }
        spaceColorObject.space.node.setHighlight({
          fill: color,
          fillOpacity: 0.4
        })
        spaceColorObjects.push(spaceColorObject)
      }
    })
  }
  function calculateAverageDistance(fpe, spaces, assets){
    const meetingRoom = spaces.filter(space => space.program === "meet")
    const socializeSpace = spaces.filter(space => space.program === "socialize")
    const restroom = spaces.filter(space => space.usage === "restroom")
    const storage = spaces.filter(space => space.usage === 'storage')
    const elevator = spaces.filter(space => space.usage === 'elevator')
    const staircase = spaces.filter(space => space.usage === 'staircase')

    const selectedSpaces = {
      meetingRoom: meetingRoom,
      socializeSpace: socializeSpace,
      restroom: restroom,
      storage: storage,
      elevator: elevator,
      staircase: staircase
    }

    const avgDistanceSpaceType = {
      meetingRoom: 0,
      socializeSpace: 0,
      restroom: 0,
      storage: 0,
      elevator: 0,
      staircase: 0
    }

    const desks = assets.filter(asset => asset.subCategories.includes("desk"))
    const deskCount = desks.length

    // for (const desk of desks){
    //   //addMarker(fpe, [desk.position.x, desk.position.z], false)
    // }

    for (let spaceType in selectedSpaces){
      const spaceCount = selectedSpaces[spaceType].length
      
      let distanceSumSpaceType = 0
      
      selectedSpaces[spaceType].map(space => {
        let distanceSumPerSpace = 0
        for (const desk of desks){
          const distance = getDistance({x: desk.position.x, y: desk.position.z}, {x: space.center[0], y: space.center[1]})
          distanceSumPerSpace = distanceSumPerSpace + distance
        }

        distanceSumSpaceType = distanceSumSpaceType + distanceSumPerSpace
      })
      avgDistanceSpaceType[spaceType] = (distanceSumSpaceType / spaceCount) / deskCount
    }
    modelUpdate({avgDistances: avgDistanceSpaceType})
  }

  function onClick(fpe){
    if(!fpe) return

    fpe.on('click', (event) => {
      const position = event.pos
      const positionResources = fpe.getResourcesFromPosition(position)
      
      if(positionResources.assets.length){
        const selectedAsset = positionResources.assets[0]
      }
      
      //remove markers if exists
      removeCursorMarker()
      removeNearestMarkers()

      //add cursorMarker
      cursorMarker = addMarker(fpe, position, false, "cursor-marker")
      
      const meetingRoom = fpe.resources.spaces.filter(space => space.program === "meet")
      const socializeSpace = fpe.resources.spaces.filter(space => space.program === "socialize")
      const restroom = fpe.resources.spaces.filter(space => space.usage === "restroom") //"restroom" || "toilet" || "bathroom"
      const storage = fpe.resources.spaces.filter(space => space.usage === 'storage')
      const elevator = fpe.resources.spaces.filter(space => space.usage === 'elevator')
      const staircase = fpe.resources.spaces.filter(space => space.usage === 'staircase')
      
      const selectedSpaces = {
        meetingRoom: meetingRoom,
        socializeSpace: socializeSpace,
        restroom: restroom,
        storage: storage,
        elevator: elevator,
        staircase: staircase
      }
      
      const aed = fpe.resources.assets.filter(asset => asset.productId == '79ee0055-9660-4cb0-9bdb-924b383890eb')
      const emergencyExit = fpe.resources.assets.filter(asset => asset.productId == 'b76ebd68-59d5-48c8-af38-0cd9d514c05c')
      const fireHose = fpe.resources.assets.filter(asset => asset.productId == 'f7bb8b7b-004d-4b7f-90fd-ad8e0b7e17c2')
      const fireAlarm = fpe.resources.assets.filter(asset => asset.productId == '530952b6-8961-4be4-b4d6-cbb9859d8756')
      const extinguisher = fpe.resources.assets.filter(asset => asset.productId == '4a60754a-19c4-41da-aa6c-13a9b3e66d4c')
      const sanitizer = fpe.resources.assets.filter(asset => asset.productId == '402d9f73-4eb1-4dbb-8108-c565cdd1edf7')
      
      const safetyAssets = {
        aed: aed,
        emergencyExit: emergencyExit,
        fireHose: fireHose,
        fireAlarm: fireAlarm,
        extinguisher: extinguisher,
        sanitizer: sanitizer
      }

      for (let spaceType in selectedSpaces){
        const spaceCenterArr = [];
        selectedSpaces[spaceType].map(space => {
          const distance = getDistance({x: position[0], y: position[1]}, {x: space.center[0], y: space.center[1]});
          spaceCenterArr.push({x: space.center[0], y: space.center[1], distance: distance});
        })
        //sort points by distance
        spaceCenterArr.sort((a, b) => a.distance - b.distance);

        for (let i = 0; i < 1; i++){
          const marker = addMarker(fpe, [spaceCenterArr[i].x, spaceCenterArr[i].y], false);
          nearestMarkers.push(marker);
          const distanceRounded = Math.round(spaceCenterArr[i].distance * 10) / 10;
          
          nearestDistances[spaceType] = distanceRounded;
        }
      }

      for (let assetType in safetyAssets){
        const assetCenterArr = [];
        safetyAssets[assetType].map(asset => {
          const distance = getDistance({x: position[0], y: position[1]}, {x: asset.position.x, y: asset.position.z});
          assetCenterArr.push({x: asset.position.x, y: asset.position.z, distance: distance});
        })
        //sort points by distance
        assetCenterArr.sort((a, b) => a.distance - b.distance);

        for (let i = 0; i < 1; i++){
          const marker = addMarker(fpe, [assetCenterArr[i].x, assetCenterArr[i].y], true, assetType);
          nearestMarkers.push(marker);
          const distanceRounded = Math.round(assetCenterArr[i].distance * 10) / 10;
          
          nearestDistances[assetType] = distanceRounded;
        }
      }
      modelUpdate({nearestDistances: nearestDistances})
    })
  }

  async function initFloorPlan(){
    if(!token || !floorId) return
    
    fpe = new FloorPlanEngine({container: container.current, options: startupSettings})
    const fpeLoaded = await fpe.loadScene(floorId, {publishableAccessToken: token})
    hasLoaded = floorId
    
    return fpe
  }
  useEffect(() => {
    if(fpe && hasLoaded === floorId) return
    if(container.current){
      initFloorPlan()
      .then((fpe) => {
        createSpaceColorObjects(fpe.resources.spaces)
        calculateAverageDistance(fpe, fpe.resources.spaces, fpe.resources.assets)
      })
    }
  })

  useEffect(() => {
    if(!fpe) return
    onClick(fpe)
  })
  
  return(
    <div className='fpe' id="floor-plan" ref={container}></div>
  )
}

export default FloorPlan