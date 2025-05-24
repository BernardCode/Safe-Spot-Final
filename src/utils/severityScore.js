// src/utils/severityModel.js

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

// Define your hazard types here:
const HAZARD_TYPES = ['quake','flood','storm'];

let model;

/**
 * One-hot encode a hazard type into [1,0,0], [0,1,0], etc.
 */
function oneHot(type) {
  return HAZARD_TYPES.map(t => (t === type ? 1 : 0));
}

/**
 * Build & train a tiny model on synthetic data
 */
export async function initModel() {
  await tf.ready();

  // inputDim = distance(1) + oneHot(3) + magnitude/waterDepth/windSpeed(3) + elevation(1) + timeOfDay(1)
  const inputDim = 1 + HAZARD_TYPES.length + 3 + 1 + 1;

  model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [inputDim] }));
  model.add(tf.layers.dense({ units: 8,  activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1,  activation: 'linear' }));
  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

  // Generate synthetic training data using your previous formula:
  const samples = 500;
  const xs = [];
  const ys = [];
  for (let i = 0; i < samples; i++) {
    const distance   = Math.random() * 20000;        // up to 20 km
    const type       = HAZARD_TYPES[Math.floor(Math.random()*HAZARD_TYPES.length)];
    const magnitude  = type==='quake' ? Math.random()*8 : 0;
    const waterDepth = type==='flood' ? Math.random()*5 : 0;
    const windSpeed  = type==='storm'? Math.random()*50: 0;
    const elevation  = Math.random()*3000;
    const hour       = Math.floor(Math.random()*24);

    // reuse your old deterministic formula for labels:
    const distScore  = Math.max(0, 1 - distance/20000);
    const hazPriority= { quake:1, flood:0.8, storm:0.7 }[type];
    const maxVal     = { quake:8, flood:5, storm:50 }[type];
    const measure    = magnitude+waterDepth+windSpeed;
    const hazScore   = Math.max(0, Math.min(1, measure/maxVal * hazPriority));
    const elevScore  = Math.max(0, 1 - (elevation/3000));
    const timeScore  = (hour<6||hour>=18) ?1:0;
    const raw        = distScore*0.3 + hazScore*0.3 + elevScore*0.15 + timeScore*0.15;
    const label      = raw * 100;

    xs.push([
      distance/20000,
      ...oneHot(type),
      magnitude/8,
      waterDepth/5,
      windSpeed/50,
      elevation/3000,
      hour/23
    ]);
    ys.push(label/100);
  }

  const inputTensor  = tf.tensor2d(xs);
  const labelTensor  = tf.tensor2d(ys, [samples,1]);

  await model.fit(inputTensor, labelTensor, { epochs: 20 });
}

/**
 * Predict a 1–100 severity score from your raw inputs.
 */
export function predictSeverity({
  distance, hazardType,
  magnitude=0, waterDepth=0, windSpeed=0,
  elevation, timeOfDay
}) {
  if (!model) throw new Error('Model not initialized');
  const input = tf.tensor2d([[
    distance/20000,
    ...oneHot(hazardType),
    magnitude/8,
    waterDepth/5,
    windSpeed/50,
    elevation/3000,
    timeOfDay/23
  ]]);
  const output = model.predict(input);
  const val = output.dataSync()[0] * 100;
  return Math.round(val);
}
