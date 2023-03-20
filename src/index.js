import React from 'react';
import ReactDOM from 'react-dom';
import FloorPlan from './FloorPlan';

const RetoolConnectedComponent = Retool.connectReactComponent(FloorPlan);
document.body.setAttribute('style', 'margin: 0; overflow: hidden;')

const wrapper = document.createElement('div')
document.body.appendChild(wrapper)
ReactDOM.render(
  <RetoolConnectedComponent/>,
  document.body.appendChild(wrapper)
);