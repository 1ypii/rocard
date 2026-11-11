import { GIFEncoder, quantize, applyPalette } from "./gifenc.js";

const faces = {
  front: document.getElementById("front"),
  back: document.getElementById("back"),
};
const flip = document.getElementById("flip");
const form = document.getElementById("lookup");
const nameInput = document.getElementById("name");
const goBtn = document.getElementById("go");
const statusEl = document.getElementById("status");
const kindsEl = document.getElementById("kinds");
const sidesEl = document.getElementById("sides");
const swatchesEl = document.getElementById("swatches");
const bgColorInput = document.getElementById("bgColor");
const bgPick = document.getElementById("bgPick");
const bgClear = document.getElementById("bgClear");
const bgFile = document.getElementById("bgFile");
const dimInput = document.getElementById("dim");
const inkInput = document.getElementById("ink");
const itemsEl = document.getElementById("items");
const scaleInput = document.getElementById("scale");
const resetBtn = document.getElementById("reset");
const savePng = document.getElementById("savePng");
const saveGif = document.getElementById("saveGif");
const saveFlip = document.getElementById("saveFlip");

const cw = 1012;
const ch = 638;
const sans = 'system-ui, "Segoe UI", sans-serif';
const mono = 'ui-monospace, Consolas, "Courier New", monospace';
const script = '"Segoe Script", "Brush Script MT", cursive';

const presets = [
  { bg: "#111111", ink: "#f2f2f2" },
  { bg: "#f1f1ef", ink: "#141414" },
  { bg: "#2b5cd6", ink: "#ffffff" },
  { bg: "#1f7a4d", ink: "#ffffff" },
  { bg: "#b3302c", ink: "#ffffff" },
  { bg: "#6b3fb8", ink: "#ffffff" },
];

const layout = {
  avatar: { side: "front", label: "avatar", x: 532, y: 148, scale: 1 },
  brand: { side: "front", label: "title", x: 64, y: 66, scale: 1 },
  chip: { side: "front", label: "chip", x: 64, y: 214, scale: 1 },
  number: { side: "front", label: "card number", x: 64, y: 346, scale: 1 },
  dates: { side: "front", label: "dates", x: 64, y: 428, scale: 1 },
  name: { side: "front", label: "name", x: 64, y: 516, scale: 1 },
  stripe: { side: "back", label: "stripe", x: 0, y: 64, scale: 1 },
  sign: { side: "back", label: "signature", x: 64, y: 236, scale: 1 },
  cvv: { side: "back", label: "security code", x: 610, y: 236, scale: 1 },
  info: { side: "back", label: "details", x: 64, y: 372, scale: 1 },
  mark: { side: "back", label: "title", x: 716, y: 536, scale: 0.7 },
};

function freshItems() {
  const items = structuredClone(layout);
  for (const id in items) items[id].show = true;
  return items;
}

let items = freshItems();
let side = "front";
let selected = null;
let drag = null;
let user = null;
let avatars = { head: null, bust: null, full: null };
let kind = "bust";
let bgColor = presets[0].bg;
let ink = presets[0].ink;
let dim = 0;
let bgFrames = [];
let bgLength = 0;
let raf = 0;
let boxes = {};

const out = document.createElement("canvas");
out.width = cw;
out.height = ch;

function cardNumber(id) {
  return String(id).padStart(16, "0").slice(-16).replace(/(.{4})/g, "$1 ").trim();
}

function title(ctx) {
  ctx.font = `700 40px ${sans}`;
  ctx.letterSpacing = "1px";
  ctx.fillText("roblox card", 0, 0);
  const top = ctx.measureText("roblox card").width;
  ctx.globalAlpha = 0.6;
  ctx.font = `500 22px ${sans}`;
  ctx.letterSpacing = "4px";
  ctx.fillText("creator debit", 0, 50);
  return [Math.max(top, ctx.measureText("creator debit").width), 76];
}

const drawers = {
  avatar(ctx) {
    const img = avatars[kind];
    if (!img) return null;
    ctx.drawImage(img, 0, 0, 510, 510);
    return [510, 510];
  },

  brand: title,
  mark: title,

  chip(ctx) {
    ctx.fillStyle = "#cdb679";
    ctx.beginPath();
    ctx.roundRect(0, 0, 96, 72, 10);
    ctx.fill();
    ctx.strokeStyle = "#8f7c48";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(32, 24);
    ctx.moveTo(0, 48);
    ctx.lineTo(32, 48);
    ctx.moveTo(64, 24);
    ctx.lineTo(96, 24);
    ctx.moveTo(64, 48);
    ctx.lineTo(96, 48);
    ctx.moveTo(32, 0);
    ctx.lineTo(32, 72);
    ctx.moveTo(64, 0);
    ctx.lineTo(64, 72);
    ctx.stroke();
    return [96, 72];
  },

  number(ctx) {
    const text = user ? cardNumber(user.id) : "0000 0000 0000 0000";
    ctx.font = `500 46px ${mono}`;
    ctx.letterSpacing = "3px";
    ctx.fillText(text, 0, 0);
    return [ctx.measureText(text).width, 48];
  },

  dates(ctx) {
    const since = user?.created ? String(new Date(user.created).getFullYear()) : "0000";
    const thru = `12/${String(new Date().getFullYear() + 4).slice(-2)}`;
    ctx.font = `500 26px ${mono}`;
    ctx.letterSpacing = "2px";
    ctx.fillText(since, 0, 26);
    ctx.fillText(thru, 200, 26);
    ctx.globalAlpha = 0.6;
    ctx.font = `500 18px ${sans}`;
    ctx.fillText("member since", 0, 0);
    ctx.fillText("valid thru", 200, 0);
    return [330, 56];
  },

  name(ctx) {
    const display = user ? user.displayName : "your name";
    const handle = user ? `@${user.name}` : "@username";
    ctx.font = `600 44px ${sans}`;
    ctx.fillText(display, 0, 0);
    const top = ctx.measureText(display).width;
    ctx.globalAlpha = 0.6;
    ctx.font = `500 24px ${sans}`;
    ctx.fillText(handle, 0, 54);
    return [Math.max(top, ctx.measureText(handle).width), 84];
  },

  stripe(ctx) {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, cw, 110);
    return [cw, 110];
  },

  sign(ctx) {
    ctx.fillStyle = "#e9e9e4";
    ctx.fillRect(0, 0, 520, 76);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `400 32px ${script}`;
    ctx.fillText(user ? user.displayName : "your name", 20, 20);
    return [520, 76];
  },

  cvv(ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 116, 76);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `500 30px ${mono}`;
    ctx.letterSpacing = "3px";
    ctx.fillText(user ? String((user.id * 7 + 123) % 1000).padStart(3, "0") : "000", 26, 24);
    return [116, 76];
  },

  info(ctx) {
    const since = user?.created ? new Date(user.created).getFullYear() : "0000";
    const lines = [
      `card holder ${user ? `@${user.name}` : "@username"}`,
      `user id ${user ? user.id : 0}`,
      `member since ${since}`,
    ];
    ctx.globalAlpha = 0.7;
    ctx.font = `500 20px ${sans}`;
    ctx.letterSpacing = "1px";
    let wide = 0;
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, i * 30);
      wide = Math.max(wide, ctx.measureText(line).width);
    });
    return [wide, 86];
  },
};

function bgFrame(t) {
  if (bgFrames.length === 1) return bgFrames[0].bmp;
  let left = t % bgLength;
  for (const frame of bgFrames) {
    if (left < frame.dur) return frame.bmp;
    left -= frame.dur;
  }
  return bgFrames[0].bmp;
}

function drawSide(ctx, which, t, editing) {
  ctx.clearRect(0, 0, cw, ch);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, cw, ch, 38);
  ctx.clip();

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);

  if (bgFrames.length) {
    const bmp = bgFrame(t);
    const fit = Math.max(cw / bmp.width, ch / bmp.height);
    const bw = bmp.width * fit;
    const bh = bmp.height * fit;
    ctx.drawImage(bmp, (cw - bw) / 2, (ch - bh) / 2, bw, bh);
  }

  if (dim > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${dim})`;
    ctx.fillRect(0, 0, cw, ch);
  }

  for (const id in items) {
    const item = items[id];
    if (item.side !== which || !item.show) continue;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.scale(item.scale, item.scale);
    ctx.fillStyle = ink;
    ctx.textBaseline = "top";
    ctx.letterSpacing = "0px";
    const size = drawers[id](ctx);
    ctx.restore();
    if (!editing) continue;
    if (!size) {
      delete boxes[id];
      continue;
    }
    boxes[id] = [item.x, item.y, size[0] * item.scale, size[1] * item.scale];
  }

  if (editing && selected && items[selected].side === which && boxes[selected]) {
    const [x, y, bw, bh] = boxes[selected];
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(x - 6, y - 6, bw + 12, bh + 12);
  }

  ctx.restore();
}

function draw() {
  const t = performance.now();
  drawSide(faces.front.getContext("2d"), "front", t, true);
  drawSide(faces.back.getContext("2d"), "back", t, true);
}

function tick() {
  draw();
  raf = requestAnimationFrame(tick);
}

function syncLoop() {
  cancelAnimationFrame(raf);
  raf = 0;
  if (bgFrames.length > 1) raf = requestAnimationFrame(tick);
  else draw();
}

function setStatus(text, bad) {
  statusEl.textContent = text;
  statusEl.classList.toggle("bad", Boolean(bad));
}

function renderItems() {
  itemsEl.replaceChildren();
  for (const id in items) {
    const item = items[id];
    if (item.side !== side) continue;
    const row = document.createElement("div");
    if (id === selected) row.classList.add("on");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = item.show;
    box.addEventListener("change", () => {
      item.show = box.checked;
      draw();
    });
    row.addEventListener("click", () => select(id));
    row.append(box, item.label);
    itemsEl.append(row);
  }
}

function select(id) {
  selected = id;
  scaleInput.disabled = !id;
  if (id) scaleInput.value = items[id].scale;
  for (const row of itemsEl.children) row.classList.remove("on");
  if (id) {
    const ids = Object.keys(items).filter((key) => items[key].side === side);
    itemsEl.children[ids.indexOf(id)]?.classList.add("on");
  }
  draw();
}

function pointAt(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return [(e.clientX - rect.left) * cw / rect.width, (e.clientY - rect.top) * ch / rect.height];
}

function hit(px, py) {
  const ids = Object.keys(items).reverse();
  for (const id of ids) {
    const item = items[id];
    const box = boxes[id];
    if (item.side !== side || !item.show || !box) continue;
    if (px >= box[0] && px <= box[0] + box[2] && py >= box[1] && py <= box[1] + box[3]) return id;
  }
  return null;
}

for (const which in faces) {
  const canvas = faces[which];

  canvas.addEventListener("pointerdown", (e) => {
    if (which !== side) return;
    const [px, py] = pointAt(canvas, e);
    const id = hit(px, py);
    select(id);
    if (!id) return;
    drag = { id, dx: px - items[id].x, dy: py - items[id].y };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", (e) => {
    if (which !== side) return;
    const [px, py] = pointAt(canvas, e);
    if (!drag) {
      canvas.style.cursor = hit(px, py) ? "grab" : "default";
      return;
    }
    const item = items[drag.id];
    const box = boxes[drag.id];
    item.x = Math.round(Math.min(cw - 24, Math.max(24 - box[2], px - drag.dx)));
    item.y = Math.round(Math.min(ch - 24, Math.max(24 - box[3], py - drag.dy)));
    draw();
  });

  const drop = () => {
    drag = null;
    canvas.style.cursor = "default";
  };
  canvas.addEventListener("pointerup", drop);
  canvas.addEventListener("pointercancel", drop);
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) {
    setStatus("usernames are 3 to 20 letters numbers or underscores", true);
    return;
  }

  goBtn.disabled = true;
  setStatus("looking up");

  try {
    const res = await fetch(`/api/user?v=2&name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "lookup failed", true);
      return;
    }

    const [head, bust, full] = await Promise.all([
      loadImage(data.avatars.head),
      loadImage(data.avatars.bust),
      loadImage(data.avatars.full),
    ]);

    flip.classList.add("swap");
    setTimeout(() => {
      user = data;
      avatars = { head, bust, full };
      draw();
      flip.classList.remove("swap");
    }, 200);

    setStatus(head && bust && full ? "" : "some avatar pictures are not ready on roblox yet, try again in a bit");
  } catch {
    setStatus("lookup failed", true);
  } finally {
    goBtn.disabled = false;
  }
});

kindsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  kindsEl.querySelector(".on").classList.remove("on");
  btn.classList.add("on");
  kind = btn.dataset.kind;
  draw();
});

sidesEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || btn.dataset.side === side) return;
  sidesEl.querySelector(".on").classList.remove("on");
  btn.classList.add("on");
  side = btn.dataset.side;
  flip.classList.toggle("back", side === "back");
  faces.front.style.pointerEvents = side === "front" ? "auto" : "none";
  faces.back.style.pointerEvents = side === "back" ? "auto" : "none";
  renderItems();
  select(null);
});

presets.forEach((preset, i) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.style.background = preset.bg;
  btn.setAttribute("aria-label", `card color ${i + 1}`);
  btn.addEventListener("click", () => {
    bgColor = preset.bg;
    ink = preset.ink;
    bgColorInput.value = bgColor;
    inkInput.value = ink;
    draw();
  });
  swatchesEl.append(btn);
});

bgColorInput.addEventListener("input", () => {
  bgColor = bgColorInput.value;
  draw();
});

inkInput.addEventListener("input", () => {
  ink = inkInput.value;
  draw();
});

dimInput.addEventListener("input", () => {
  dim = Number(dimInput.value);
  draw();
});

scaleInput.addEventListener("input", () => {
  if (!selected) return;
  items[selected].scale = Number(scaleInput.value);
  draw();
});

resetBtn.addEventListener("click", () => {
  items = freshItems();
  renderItems();
  select(null);
});

function clearBg() {
  for (const frame of bgFrames) frame.bmp.close();
  bgFrames = [];
  bgLength = 0;
  bgClear.disabled = true;
}

async function readFrames(file) {
  if (file.type !== "image/gif" || !("ImageDecoder" in window)) {
    return [{ bmp: await createImageBitmap(file), dur: 0 }];
  }

  const decoder = new ImageDecoder({ data: await file.arrayBuffer(), type: "image/gif" });
  await decoder.tracks.ready;
  await decoder.completed;
  const count = Math.min(decoder.tracks.selectedTrack.frameCount, 120);
  const frames = [];
  for (let i = 0; i < count; i++) {
    const { image } = await decoder.decode({ frameIndex: i });
    frames.push({ bmp: await createImageBitmap(image), dur: Math.max(20, (image.duration ?? 100000) / 1000) });
    image.close();
  }
  decoder.close();
  return frames;
}

bgPick.addEventListener("click", () => bgFile.click());

bgFile.addEventListener("change", async () => {
  const file = bgFile.files[0];
  bgFile.value = "";
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    setStatus("background has to be a png jpg webp or gif", true);
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    setStatus("background is too big, keep it under 20mb", true);
    return;
  }

  try {
    const frames = await readFrames(file);
    clearBg();
    bgFrames = frames;
    bgLength = frames.reduce((sum, frame) => sum + frame.dur, 0);
    bgClear.disabled = false;
    setStatus("");
  } catch {
    setStatus("could not read that image", true);
  }
  syncLoop();
});

bgClear.addEventListener("click", () => {
  clearBg();
  syncLoop();
});

function download(blob, tag, ext) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `rocard ${user ? user.name : "card"} ${tag}.${ext}`;
  link.click();
  URL.revokeObjectURL(link.href);
}

savePng.addEventListener("click", () => {
  drawSide(out.getContext("2d"), side, performance.now(), false);
  out.toBlob((blob) => {
    if (blob) download(blob, side, "png");
  }, "image/png");
});

function flipShots() {
  const step = 40;
  const hold = 720;
  const turn = 680;
  const shots = [];
  for (let t = 0; t < (hold + turn) * 2; t += step) {
    const half = t < hold + turn ? 0 : 1;
    const local = t - half * (hold + turn);
    let angle = 0;
    if (local > hold) {
      const u = (local - hold) / turn;
      angle = (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)) * Math.PI;
    }
    const turned = angle > Math.PI / 2;
    const showsBack = half === 0 ? turned : !turned;
    shots.push({
      side: showsBack ? "back" : "front",
      t,
      delay: step,
      squash: Math.max(0.03, Math.abs(Math.cos(angle))),
    });
  }
  return shots;
}

async function exportGif(spin) {
  const gw = 506;
  const gh = 319;
  const small = document.createElement("canvas");
  small.width = gw;
  small.height = gh;
  const sctx = small.getContext("2d", { willReadFrequently: true });
  const octx = out.getContext("2d");

  let shots = [{ side, t: 0, delay: 1000, squash: 1 }];
  if (spin) {
    shots = flipShots();
  } else if (bgFrames.length > 1) {
    let t = 0;
    shots = bgFrames.map((frame) => {
      const shot = { side, t, delay: frame.dur, squash: 1 };
      t += frame.dur;
      return shot;
    });
  }

  savePng.disabled = saveGif.disabled = saveFlip.disabled = true;
  const gif = GIFEncoder();

  try {
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      drawSide(octx, shot.side, shot.t, false);
      sctx.clearRect(0, 0, gw, gh);
      sctx.save();
      sctx.translate(gw / 2, 0);
      sctx.scale(shot.squash, 1);
      sctx.drawImage(out, -gw / 2, 0, gw, gh);
      sctx.restore();

      const data = sctx.getImageData(0, 0, gw, gh).data;
      const palette = quantize(data, 255, { format: "rgb565" });
      const index = applyPalette(data, palette, "rgb565");
      while (palette.length < 256) palette.push([0, 0, 0]);
      for (let p = 0; p < index.length; p++) {
        if (data[p * 4 + 3] < 128) index[p] = 255;
      }
      gif.writeFrame(index, gw, gh, { palette, delay: shot.delay, transparent: true, transparentIndex: 255, dispose: 2 });

      if (i % 4 === 0) {
        setStatus(`making gif ${Math.round((i / shots.length) * 100)}%`);
        await new Promise((resolve) => setTimeout(resolve));
      }
    }

    gif.finish();
    download(new Blob([gif.bytes()], { type: "image/gif" }), spin ? "flip" : side, "gif");
    setStatus("");
  } catch {
    setStatus("could not make the gif", true);
  } finally {
    savePng.disabled = saveGif.disabled = saveFlip.disabled = false;
  }
}

saveGif.addEventListener("click", () => exportGif(false));
saveFlip.addEventListener("click", () => exportGif(true));

faces.back.style.pointerEvents = "none";
renderItems();
draw();
