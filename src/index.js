import React from 'react';
import ReactDOM from 'react-dom';
import FloorPlan from './FloorPlan';

//import { indexedDB } from 'fake-indexeddb';
// window.indexedDB = { polyfill : true };
// import './indexedDB.js';
// window.indexedDB = indexedDB
// Whenever you want a fresh indexedDB
//indexedDB = new IDBFactory();
//indexedDB.open = {}

const RetoolConnectedComponent = Retool.connectReactComponent(FloorPlan);
document.body.setAttribute('style', 'margin: 0;')

const wrapper = document.createElement('div')
document.body.appendChild(wrapper)
ReactDOM.render(
  <RetoolConnectedComponent/>,
  document.body.appendChild(wrapper)
);