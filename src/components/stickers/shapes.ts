/**
 * Sticker artwork.
 *
 * Every sticker is vector path data drawn here, in a 100×100 box. Vector art
 * means a sticker is crisp on a phone, crisp on a 4K screen and crisp at 300 DPI
 * on paper, from one small definition — and there is no image to load, so the
 * whole library is available offline from the first visit.
 *
 * Each path names a colour slot, so one shape can be recoloured to match any
 * theme without redrawing it.
 */

export interface ShapePath {
  d: string;
  /** Which colour slot fills this path. */
  slot: 0 | 1 | 2 | 3;
  /** Stroke rather than fill. */
  stroke?: boolean;
  strokeWidth?: number;
  opacity?: number;
  round?: boolean;
}

export interface Shape {
  /** How many colours this shape uses. */
  slots: number;
  paths: ShapePath[];
}

const heart = 'M50 88C22 68 8 52 8 36 8 22 19 12 32 12c8 0 15 4 18 10 3-6 10-10 18-10 13 0 24 10 24 24 0 16-14 32-42 52z';
const star =
  'M50 6l12 27 30 3-22 20 6 30-26-15-26 15 6-30L8 36l30-3z';
const flowerPetals =
  'M50 14c8 0 14 6 14 14 0 3-1 6-2 8 2-1 5-2 8-2 8 0 14 6 14 14s-6 14-14 14c-3 0-6-1-8-2 1 2 2 5 2 8 0 8-6 14-14 14s-14-6-14-14c0-3 1-6 2-8-2 1-5 2-8 2-8 0-14-6-14-14s6-14 14-14c3 0 6 1 8 2-1-2-2-5-2-8 0-8 6-14 14-14z';
const circle = 'M50 10a40 40 0 1 0 0 80 40 40 0 0 0 0-80z';
const cloud =
  'M28 70c-11 0-19-8-19-18 0-9 7-17 16-18 3-11 13-19 25-19 13 0 24 9 26 22 9 1 16 8 16 17 0 10-8 16-18 16z';
const speechBubble =
  'M14 16h72c4 0 8 4 8 8v40c0 4-4 8-8 8H44L24 90V72H14c-4 0-8-4-8-8V24c0-4 4-8 8-8z';
const sparkle = 'M50 8c4 22 16 34 38 38-22 4-34 16-38 38-4-22-16-34-38-38 22-4 34-16 38-38z';
const butterflyWings =
  'M50 30c-6-14-20-20-30-14C8 22 8 42 20 52 10 58 8 72 16 80c10 10 26 2 34-14 8 16 24 24 34 14 8-8 6-22-4-28 12-10 12-30 0-36-10-6-24 0-30 14z';
const rainbowArc = (radius: number): string =>
  `M${50 - radius} 78a${radius} ${radius} 0 0 1 ${radius * 2} 0`;
const sunRays =
  'M50 4v14M50 82v14M4 50h14M82 50h14M17 17l10 10M73 73l10 10M83 17L73 27M27 73l-10 10';
const envelopeBody = 'M8 26h84v48H8z';
const envelopeFlap = 'M8 26l42 30 42-30';
const stampEdge =
  'M14 10h72v80H14z';
const tapeStrip = 'M4 34h92v32H4z';
const arrowCurved = 'M12 74c18-40 46-52 74-46';
const arrowHead = 'M78 16l14 12-18 8z';
const cakeBase = 'M16 52h68v34H16z';
const cakeTop = 'M16 40h68v14H16z';
const balloonBody = 'M50 8c16 0 28 13 28 30 0 18-18 32-28 32S22 56 22 38C22 21 34 8 50 8z';
const giftBox = 'M12 40h76v50H12z';
const giftLid = 'M8 26h84v16H8z';
const cameraBody = 'M10 30h80v54H10z';
const cameraLens = 'M50 44a16 16 0 1 0 0 32 16 16 0 0 0 0-32z';
const bookCover = 'M16 14h60c4 0 6 3 6 6v66c0 3-2 6-6 6H16z';
const musicNote =
  'M62 12v46a14 12 0 1 1-8-11V30L36 36v34a14 12 0 1 1-8-11V26z';
const catFace = 'M22 34l6-22 18 12h8l18-12 6 22v26c0 14-14 24-28 24S22 74 22 60z';
const pawPad = 'M50 52c12 0 20 8 20 16s-9 12-20 12-20-4-20-12 8-16 20-16z';
const leaf = 'M50 90C24 74 18 44 34 22c18 6 38 26 16 68z';
const mountain = 'M6 82L36 30l18 28 12-16 28 40z';
const wave = 'M6 60c10-12 18-12 28 0s18 12 28 0 18-12 28 0';
const cupBody = 'M20 30h50v34c0 10-8 18-18 18H38c-10 0-18-8-18-18z';
const iceCream = 'M50 88L28 42h44z';
const scoop = 'M50 10a22 22 0 0 1 22 22c0 6-44 6-44 0a22 22 0 0 1 22-22z';
const pencilBody = 'M22 84l8-22 42-42 14 14-42 42z';
const pencilTip = 'M22 84l14-6-8-8z';
const ribbonBow =
  'M50 46c-8-14-30-20-36-8-5 10 10 20 36 20 26 0 41-10 36-20-6-12-28-6-36 8z';
const medal = 'M50 30a24 24 0 1 0 0 48 24 24 0 0 0 0-48z';
const kite = 'M50 6L88 46 50 94 12 46z';
const smileyFace = circle;
const smileyEyes = 'M36 42a5 6 0 1 0 0 12 5 6 0 0 0 0-12zM64 42a5 6 0 1 0 0 12 5 6 0 0 0 0-12z';
const smileyMouth = 'M32 62c6 10 30 10 36 0';
const plantPot = 'M26 60h48l-6 30H32z';
const plantStem = 'M50 60V26M50 40c-10 0-16-8-16-16 10-2 16 6 16 16zM50 46c10 0 16-8 16-16-10-2-16 6-16 16z';
const houseBody = 'M20 46h60v42H20z';
const houseRoof = 'M10 48L50 14l40 34';
const planeBody = 'M8 54l84-34-30 66-12-22z';
const globe = circle;
const globeLines = 'M10 50h80M50 10c14 14 14 66 0 80M50 10C36 24 36 76 50 90';
const clockFace = circle;
const clockHands = 'M50 26v26l18 10';
const bulb = 'M50 10c14 0 24 10 24 23 0 9-6 14-9 20H35c-3-6-9-11-9-20 0-13 10-23 24-23z';
const bulbBase = 'M38 58h24v12H38z';
const diamond = 'M50 8l30 34-30 50-30-50z';
const crown = 'M14 76l-6-44 20 14 22-30 22 30 20-14-6 44z';
const flag = 'M26 10v80M26 16h48l-10 14 10 14H26z';
const tickBox = 'M16 16h68v68H16z';
const tickMark = 'M28 52l14 16 30-34';
const donut = 'M50 12a38 38 0 1 0 0 76 38 38 0 0 0 0-76zm0 26a12 12 0 1 1 0 24 12 12 0 0 1 0-24z';
const stripePattern = 'M0 20h100M0 40h100M0 60h100M0 80h100';
const zigzag = 'M4 70l16-24 16 24 16-24 16 24 16-24 12 18';
const diamondGrid = 'M50 20l20 30-20 30-20-30zM14 50l10-14 10 14-10 14zM76 50l10-14 10 14-10 14z';
const adinkraSpiral =
  'M50 18c18 0 32 14 32 32 0 14-10 24-24 24-11 0-20-8-20-18 0-8 6-14 14-14 6 0 10 4 10 9';
const kenteBand = 'M6 26h88v16H6zM6 56h88v16H6z';
const beadRow =
  'M18 50a8 8 0 1 0 0.1 0zM42 50a8 8 0 1 0 0.1 0zM66 50a8 8 0 1 0 0.1 0zM90 50a8 8 0 1 0 0.1 0z';
const sunHat = 'M14 70c0-6 16-10 36-10s36 4 36 10-16 10-36 10-36-4-36-10zM32 62c0-16 8-28 18-28s18 12 18 28';
const floppyDisk = 'M14 14h58l14 14v58H14z';
const floppyLabel = 'M30 52h40v34H30zM34 14h28v22H34z';
const monitorBody = 'M8 16h84v54H8z';
const monitorStand = 'M40 70h20v12H40zM28 82h44v8H28z';
const chatIcon = speechBubble;
const pixelHeart =
  'M20 26h16v-8h-8v-8h24v8h-8v8h16v16h-8v8h-8v8h-8v8h-8v-8h-8v-8h-8v-8h-8z';
const cassette = 'M10 24h80v52H10z';
const cassetteReels = 'M32 50a10 10 0 1 0 0.1 0zM68 50a10 10 0 1 0 0.1 0zM28 66h44v10H28z';
const phoneBody = 'M28 6h44c5 0 8 3 8 8v72c0 5-3 8-8 8H28c-5 0-8-3-8-8V14c0-5 3-8 8-8z';
const phoneScreen = 'M28 20h44v56H28z';

export const SHAPES: Record<string, Shape> = {
  heart: { slots: 2, paths: [{ d: heart, slot: 0 }, { d: heart, slot: 1, stroke: true, strokeWidth: 3 }] },
  'heart-outline': { slots: 1, paths: [{ d: heart, slot: 0, stroke: true, strokeWidth: 5 }] },
  star: { slots: 2, paths: [{ d: star, slot: 0 }, { d: star, slot: 1, stroke: true, strokeWidth: 3 }] },
  'star-outline': { slots: 1, paths: [{ d: star, slot: 0, stroke: true, strokeWidth: 5 }] },
  flower: {
    slots: 2,
    paths: [
      { d: flowerPetals, slot: 0 },
      { d: 'M50 38a12 12 0 1 0 0 24 12 12 0 0 0 0-24z', slot: 1 },
    ],
  },
  smiley: {
    slots: 3,
    paths: [
      { d: smileyFace, slot: 0 },
      { d: smileyEyes, slot: 1 },
      { d: smileyMouth, slot: 1, stroke: true, strokeWidth: 5, round: true },
      { d: smileyFace, slot: 2, stroke: true, strokeWidth: 3 },
    ],
  },
  cloud: { slots: 2, paths: [{ d: cloud, slot: 0 }, { d: cloud, slot: 1, stroke: true, strokeWidth: 3 }] },
  rainbow: {
    slots: 4,
    paths: [
      { d: rainbowArc(42), slot: 0, stroke: true, strokeWidth: 10, round: true },
      { d: rainbowArc(31), slot: 1, stroke: true, strokeWidth: 10, round: true },
      { d: rainbowArc(20), slot: 2, stroke: true, strokeWidth: 10, round: true },
      { d: rainbowArc(9), slot: 3, stroke: true, strokeWidth: 10, round: true },
    ],
  },
  sparkle: { slots: 2, paths: [{ d: sparkle, slot: 0 }, { d: 'M76 12c2 10 7 15 17 17-10 2-15 7-17 17-2-10-7-15-17-17 10-2 15-7 17-17z', slot: 1 }] },
  butterfly: {
    slots: 3,
    paths: [
      { d: butterflyWings, slot: 0 },
      { d: butterflyWings, slot: 1, stroke: true, strokeWidth: 3 },
      { d: 'M50 26v50M50 26l-6-10M50 26l6-10', slot: 2, stroke: true, strokeWidth: 4, round: true },
    ],
  },
  sun: {
    slots: 2,
    paths: [
      { d: 'M50 24a26 26 0 1 0 0 52 26 26 0 0 0 0-52z', slot: 0 },
      { d: sunRays, slot: 1, stroke: true, strokeWidth: 6, round: true },
    ],
  },
  moon: { slots: 2, paths: [{ d: 'M62 8a42 42 0 1 0 30 52A34 34 0 0 1 62 8z', slot: 0 }, { d: 'M30 34a4 4 0 1 0 .1 0zM44 60a5 5 0 1 0 .1 0z', slot: 1 }] },
  speech: {
    slots: 2,
    paths: [
      { d: speechBubble, slot: 0 },
      { d: speechBubble, slot: 1, stroke: true, strokeWidth: 4 },
    ],
  },
  arrow: {
    slots: 1,
    paths: [
      { d: arrowCurved, slot: 0, stroke: true, strokeWidth: 6, round: true },
      { d: arrowHead, slot: 0 },
    ],
  },
  envelope: {
    slots: 3,
    paths: [
      { d: envelopeBody, slot: 0 },
      { d: envelopeFlap, slot: 1, stroke: true, strokeWidth: 4 },
      { d: envelopeBody, slot: 2, stroke: true, strokeWidth: 4 },
    ],
  },
  stamp: {
    slots: 3,
    paths: [
      { d: stampEdge, slot: 0 },
      { d: 'M24 20h52v60H24z', slot: 1 },
      { d: heart, slot: 2, opacity: 0.9 },
    ],
  },
  tape: { slots: 1, paths: [{ d: tapeStrip, slot: 0, opacity: 0.65 }] },
  cake: {
    slots: 3,
    paths: [
      { d: cakeBase, slot: 0 },
      { d: cakeTop, slot: 1 },
      { d: 'M34 40V20M50 40V16M66 40V20', slot: 2, stroke: true, strokeWidth: 5, round: true },
    ],
  },
  balloon: {
    slots: 2,
    paths: [
      { d: balloonBody, slot: 0 },
      { d: 'M50 70c6 10-6 14 0 24', slot: 1, stroke: true, strokeWidth: 3 },
    ],
  },
  gift: {
    slots: 3,
    paths: [
      { d: giftBox, slot: 0 },
      { d: giftLid, slot: 1 },
      { d: 'M50 26v64', slot: 2, stroke: true, strokeWidth: 8 },
    ],
  },
  camera: {
    slots: 3,
    paths: [
      { d: cameraBody, slot: 0 },
      { d: 'M34 16h32v14H34z', slot: 1 },
      { d: cameraLens, slot: 2 },
    ],
  },
  book: {
    slots: 3,
    paths: [
      { d: bookCover, slot: 0 },
      { d: 'M16 14v78', slot: 1, stroke: true, strokeWidth: 8 },
      { d: 'M30 34h38M30 48h38M30 62h26', slot: 2, stroke: true, strokeWidth: 4, round: true },
    ],
  },
  music: { slots: 1, paths: [{ d: musicNote, slot: 0 }] },
  cat: {
    slots: 3,
    paths: [
      { d: catFace, slot: 0 },
      { d: 'M38 52a4 5 0 1 0 .1 0zM62 52a4 5 0 1 0 .1 0z', slot: 1 },
      { d: 'M44 66c4 4 8 4 12 0', slot: 2, stroke: true, strokeWidth: 4, round: true },
    ],
  },
  paw: {
    slots: 2,
    paths: [
      { d: pawPad, slot: 0 },
      { d: 'M28 34a8 10 0 1 0 .1 0zM44 26a8 10 0 1 0 .1 0zM60 26a8 10 0 1 0 .1 0zM76 34a8 10 0 1 0 .1 0z', slot: 1 },
    ],
  },
  leaf: { slots: 2, paths: [{ d: leaf, slot: 0 }, { d: 'M50 90C42 66 40 42 34 22', slot: 1, stroke: true, strokeWidth: 3 }] },
  mountain: { slots: 2, paths: [{ d: mountain, slot: 0 }, { d: 'M36 30l10 16-20 0z', slot: 1 }] },
  wave: { slots: 1, paths: [{ d: wave, slot: 0, stroke: true, strokeWidth: 7, round: true }] },
  cup: {
    slots: 3,
    paths: [
      { d: cupBody, slot: 0 },
      { d: 'M70 40h8a10 10 0 0 1 0 20h-8', slot: 1, stroke: true, strokeWidth: 5 },
      { d: 'M34 22c0-6 6-6 6-12M50 22c0-6 6-6 6-12', slot: 2, stroke: true, strokeWidth: 4, round: true },
    ],
  },
  'ice-cream': { slots: 2, paths: [{ d: iceCream, slot: 0 }, { d: scoop, slot: 1 }] },
  pencil: {
    slots: 3,
    paths: [
      { d: pencilBody, slot: 0 },
      { d: pencilTip, slot: 1 },
      { d: 'M64 20l14 14', slot: 2, stroke: true, strokeWidth: 5 },
    ],
  },
  ribbon: { slots: 2, paths: [{ d: ribbonBow, slot: 0 }, { d: 'M50 46a8 8 0 1 0 .1 0z', slot: 1 }] },
  medal: {
    slots: 3,
    paths: [
      { d: medal, slot: 0 },
      { d: 'M34 10l16 22M66 10L50 32', slot: 1, stroke: true, strokeWidth: 8 },
      { d: star, slot: 2, opacity: 0.9 },
    ],
  },
  kite: {
    slots: 3,
    paths: [
      { d: kite, slot: 0 },
      { d: 'M50 6v88M12 46h76', slot: 1, stroke: true, strokeWidth: 3 },
      { d: 'M50 94c8 4 2 10 10 14', slot: 2, stroke: true, strokeWidth: 3 },
    ],
  },
  plant: {
    slots: 3,
    paths: [
      { d: plantPot, slot: 0 },
      { d: plantStem, slot: 1 },
      { d: 'M26 60h48', slot: 2, stroke: true, strokeWidth: 5 },
    ],
  },
  house: {
    slots: 3,
    paths: [
      { d: houseBody, slot: 0 },
      { d: houseRoof, slot: 1, stroke: true, strokeWidth: 8, round: true },
      { d: 'M42 60h16v28H42z', slot: 2 },
    ],
  },
  plane: { slots: 2, paths: [{ d: planeBody, slot: 0 }, { d: 'M44 44l14 14', slot: 1, stroke: true, strokeWidth: 3 }] },
  globe: {
    slots: 2,
    paths: [
      { d: globe, slot: 0 },
      { d: globeLines, slot: 1, stroke: true, strokeWidth: 4 },
    ],
  },
  clock: {
    slots: 2,
    paths: [
      { d: clockFace, slot: 0 },
      { d: clockHands, slot: 1, stroke: true, strokeWidth: 5, round: true },
    ],
  },
  bulb: {
    slots: 3,
    paths: [
      { d: bulb, slot: 0 },
      { d: bulbBase, slot: 1 },
      { d: 'M50 24v20M40 34h20', slot: 2, stroke: true, strokeWidth: 4 },
    ],
  },
  diamond: { slots: 2, paths: [{ d: diamond, slot: 0 }, { d: 'M20 42h60M50 8L36 42l14 50 14-50z', slot: 1, stroke: true, strokeWidth: 3 }] },
  crown: { slots: 2, paths: [{ d: crown, slot: 0 }, { d: crown, slot: 1, stroke: true, strokeWidth: 4 }] },
  flag: { slots: 2, paths: [{ d: flag, slot: 0, stroke: true, strokeWidth: 6, round: true }, { d: 'M28 18h44l-9 14 9 14H28z', slot: 1 }] },
  tick: { slots: 2, paths: [{ d: tickBox, slot: 0, stroke: true, strokeWidth: 6 }, { d: tickMark, slot: 1, stroke: true, strokeWidth: 8, round: true }] },
  donut: { slots: 2, paths: [{ d: donut, slot: 0 }, { d: 'M26 40c8-6 12 4 20-2M56 30c8-2 8 8 16 6M34 66c6 6 12-2 18 4', slot: 1, stroke: true, strokeWidth: 4, round: true }] },
  stripes: { slots: 1, paths: [{ d: stripePattern, slot: 0, stroke: true, strokeWidth: 10 }] },
  zigzag: { slots: 1, paths: [{ d: zigzag, slot: 0, stroke: true, strokeWidth: 8, round: true }] },
  'diamond-grid': { slots: 2, paths: [{ d: diamondGrid, slot: 0 }, { d: diamondGrid, slot: 1, stroke: true, strokeWidth: 3 }] },
  adinkra: { slots: 1, paths: [{ d: adinkraSpiral, slot: 0, stroke: true, strokeWidth: 8, round: true }] },
  kente: {
    slots: 3,
    paths: [
      { d: kenteBand, slot: 0 },
      { d: 'M6 44h88v10H6z', slot: 1 },
      { d: 'M18 26v46M38 26v46M58 26v46M78 26v46', slot: 2, stroke: true, strokeWidth: 5 },
    ],
  },
  beads: { slots: 2, paths: [{ d: beadRow, slot: 0 }, { d: 'M6 50h88', slot: 1, stroke: true, strokeWidth: 3 }] },
  'sun-hat': { slots: 2, paths: [{ d: sunHat, slot: 0 }, { d: 'M32 62c14-6 22-6 36 0', slot: 1, stroke: true, strokeWidth: 5 }] },
  floppy: { slots: 2, paths: [{ d: floppyDisk, slot: 0 }, { d: floppyLabel, slot: 1 }] },
  monitor: {
    slots: 3,
    paths: [
      { d: monitorBody, slot: 0 },
      { d: 'M16 24h68v38H16z', slot: 1 },
      { d: monitorStand, slot: 2 },
    ],
  },
  chat: { slots: 2, paths: [{ d: chatIcon, slot: 0 }, { d: 'M26 34h48M26 48h34', slot: 1, stroke: true, strokeWidth: 6, round: true }] },
  'pixel-heart': { slots: 1, paths: [{ d: pixelHeart, slot: 0 }] },
  cassette: {
    slots: 3,
    paths: [
      { d: cassette, slot: 0 },
      { d: 'M20 34h60v28H20z', slot: 1 },
      { d: cassetteReels, slot: 2 },
    ],
  },
  phone: {
    slots: 3,
    paths: [
      { d: phoneBody, slot: 0 },
      { d: phoneScreen, slot: 1 },
      { d: 'M42 84h16', slot: 2, stroke: true, strokeWidth: 4, round: true },
    ],
  },
};

export function getShape(id: string): Shape | undefined {
  return SHAPES[id];
}

export const SHAPE_IDS = Object.keys(SHAPES);
