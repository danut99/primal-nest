// Noctyra & Stella: adaugă oase, sloturi și animații reale Spine peste scheletul nativ, după încărcare.
//   - Sceptrul lunar e un os copil al mâinii din față: îl ține în palmă în orice animație (respirație, mers,
//     zbor, atac, ultimată), pentru că se mișcă odată cu mâna.
//   - Stella (vulpea) e un os copil al trunchiului care moștenește doar poziția: se deplasează odată cu
//     dragonul, dar rămâne dreaptă, cu plutirea ei proprie peste fiecare animație.
//   - „ult2”: Stella orbitează, se sincronizează cu sceptrul și declanșează unda astrală.

async function loadImage(url, signal) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const clean = () => signal?.removeEventListener('abort', abort);
    const abort = () => {
      clean();
      img.src = '';
      reject(new DOMException('Aborted', 'AbortError'));
    };
    img.onload = () => {
      clean();
      resolve(img);
    };
    img.onerror = () => {
      clean();
      reject(new Error('Assetul companionului nu se poate încărca: ' + url));
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    img.src = url;
  });
}

/** Primul os care există din listă (numele diferă puțin între vârste). */
function findBone(skeleton, names, fallback) {
  for (const name of names) {
    const bone = skeleton.findBone(name);
    if (bone) return bone;
  }
  return fallback;
}

export async function prepare({ baseUrl, variant, signal }) {
  const config = variant.extensionConfig;
  const images = await Promise.all([config.companion, config.weapon].map((file) => loadImage(baseUrl + '/' + file, signal)));
  return function install(raw, s) {
    const data = raw.skeleton.data;
    const originals = [...data.animations];
    const oldSlots = data.slots.length;
    const b = config.sourceBounds;
    const H = b.height;

    // Poza de referință: primul cadru din respirație (mâinile și trunchiul în poziția obișnuită).
    const pose = raw.skeleton;
    if (!data.defaultSkin && data.skins.length && !pose.skin) pose.setSkin(data.skins[0]);
    pose.setToSetupPose();
    const breathe = data.findAnimation('breathe');
    if (breathe) breathe.apply(pose, 0, 0, false, null, 1, s.MixBlend.setup, s.MixDirection.mixIn);
    pose.updateWorldTransform();
    const rootBone = pose.bones[0];
    const hand = findBone(pose, ['palm_2_l', 'palm_l', 'hand_l', 'forearm_2_l', 'palm_2_r'], rootBone);
    const body = findBone(pose, ['body_2', 'body_1', 'character'], rootBone);

    // Texturile noi, într-un atlas mic, separat de cel nativ.
    const textures = images.map((image) => new s.webgl.GLTexture(raw.context, image));
    const atlasText = images
      .map(
        (image, i) =>
          `extra${i}.png\nsize: ${image.width},${image.height}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n${i === 0 ? 'stella' : 'staff'}\n  rotate: false\n  xy: 0,0\n  size: ${image.width},${image.height}\n  orig: ${image.width},${image.height}\n  offset: 0,0\n  index: -1\n`,
      )
      .join('\n');
    const atlas = new s.TextureAtlas(atlasText, (name) => textures[Number(name[5])]);
    const nativeAtlas = raw.assetManager.get(raw.config.atlasUrl);

    function region(name, atlasRegion, width, height, offsetY = 0) {
      atlasRegion.renderObject = atlasRegion;
      const attachment = new s.RegionAttachment(name);
      attachment.setRegion(atlasRegion);
      attachment.width = width;
      attachment.height = height;
      attachment.y = offsetY;
      attachment.updateOffset();
      return attachment;
    }

    /**
     * Un os nou, copil al lui `parent`, așezat în lume la (x, y) cu rotația `worldRotation` în poza de referință.
     * Poziția și rotația se calculează în spațiul părintelui, deci osul urmează apoi orice mișcare a lui.
     */
    function addBone(name, parent, x, y, worldRotation, onlyTranslation) {
      const boneData = new s.BoneData(data.bones.length, name, parent.data);
      const local = new s.Vector2(x, y);
      parent.worldToLocal(local);
      boneData.x = local.x;
      boneData.y = local.y;
      if (onlyTranslation) {
        boneData.transformMode = s.TransformMode.OnlyTranslation;
      } else {
        boneData.rotation = worldRotation - parent.getWorldRotationX();
        boneData.scaleX = 1 / (parent.getWorldScaleX() || 1);
        boneData.scaleY = 1 / (parent.getWorldScaleY() || 1);
      }
      data.bones.push(boneData);
      return boneData;
    }

    function addSlot(name, boneData, attachment, hidden = false) {
      const slot = new s.SlotData(data.slots.length, name, boneData);
      slot.attachmentName = name;
      slot.blendMode = s.BlendMode.Normal;
      if (hidden) slot.color.a = 0;
      data.slots.push(slot);
      for (const skin of data.skins) skin.setAttachment(slot.index, name, attachment);
    }

    // Sceptrul: mânerul în labă (la 22% de jos), drept în sus, ușor aplecat înainte; capul trece de capul dragonului.
    const staffHeight = H * 0.78;
    const staffWidth = (staffHeight * images[1].width) / images[1].height;
    const staffBone = addBone('moonstaff', hand, hand.worldX, hand.worldY, -8, false);
    addSlot('moonstaff', staffBone, region('moonstaff', atlas.findRegion('staff'), staffWidth, staffHeight, staffHeight * 0.28));

    // Stella: plutește lângă umărul din față, legată de trunchi doar prin poziție.
    const stellaSize = H * 0.38;
    const stellaX = b.x + b.width + H * 0.02;
    const stellaY = b.y + H * 0.5;
    const stellaBone = addBone('stella', body, stellaX, stellaY, 0, true);
    addSlot('stella', stellaBone, region('stella', atlas.findRegion('stella'), stellaSize, (stellaSize * images[0].height) / images[0].width));

    // Unda astrală a ultimatei: centrul corpului, legată de rădăcină.
    const cx = b.x + b.width * 0.52;
    const cy = b.y + H * 0.48;
    const ring = nativeAtlas.findRegion('fx/circle_hard2') || nativeAtlas.findRegion('fx/Sparks 097_1');
    if (!ring) throw new Error('Atlasul nu conține cercul astral.');
    const waveBone = addBone('astralwave', rootBone, cx, cy, 0, true);
    addSlot('astralwave', waveBone, region('astralwave', ring, H * 0.5, H * 0.5), true);

    // Cheile de ordine a desenării din animațiile native trebuie să includă sloturile noi.
    const extraIndices = data.slots.slice(oldSlots).map((slot) => slot.index);
    for (const a of originals)
      for (const t of a.timelines)
        if (t instanceof s.DrawOrderTimeline) t.drawOrders = t.drawOrders.map((order) => (order ? Array.from(order).concat(extraIndices) : null));

    const parser = new s.SkeletonJson(null);
    function parse(map, name) {
      parser.readAnimation(map, name, data);
      return data.animations.pop();
    }

    // Peste fiecare animație nativă: Stella plutește și se leagănă ușor; sceptrul se mișcă cu mâna.
    const smooth = 0.35;
    for (const a of originals) {
      const d = a.duration;
      const extra = parse(
        {
          bones: {
            stella: {
              translate: [
                { time: 0, x: 0, y: 0, curve: smooth },
                { time: d * 0.5, x: H * 0.012, y: H * 0.04, curve: smooth },
                { time: d, x: 0, y: 0 },
              ],
              rotate: [
                { time: 0, angle: -3 },
                { time: d * 0.5, angle: 3 },
                { time: d, angle: -3 },
              ],
            },
          },
        },
        '__extra',
      );
      const i = data.animations.indexOf(a);
      data.animations[i] = new s.Animation(a.name, [...a.timelines, ...extra.timelines], d);
    }

    // ult2: zbor pe loc; Stella face o orbită în jurul dragonului, vine la sceptru, apoi unda astrală.
    const duration = 4.8;
    const orbit = [];
    for (let i = 0; i <= 16; i++) {
      const time = 0.45 + (i * 1.9) / 16;
      const angle = Math.PI * 0.15 + (i * Math.PI * 2) / 16;
      orbit.push({ time, x: cx + Math.cos(angle) * H * 0.63 - stellaX, y: cy + Math.sin(angle) * H * 0.43 - stellaY });
    }
    // Capul sceptrului (în lume, la poza de referință): acolo vine Stella pentru sincronizare.
    const staffTopX = hand.worldX + Math.sin((8 * Math.PI) / 180) * staffHeight * 0.78;
    const staffTopY = hand.worldY + staffHeight * 0.78;
    const ult = parse(
      {
        bones: {
          [rootBone.data.name]: {
            translate: [
              { time: 0, x: 0, y: 0 },
              { time: 1.5, x: -H * 0.06, y: H * 0.06 },
              { time: 2.7, x: -H * 0.12, y: H * 0.1 },
              { time: 3.1, x: H * 0.12, y: 0 },
              { time: 3.65, x: H * 0.02, y: 0 },
              { time: duration, x: 0, y: 0 },
            ],
            rotate: [
              { time: 0, angle: 0 },
              { time: 1.5, angle: 4 },
              { time: 2.7, angle: 7 },
              { time: 3.1, angle: -5 },
              { time: 3.65, angle: 0 },
              { time: duration, angle: 0 },
            ],
          },
          stella: {
            translate: [
              { time: 0, x: 0, y: 0 },
              { time: 0.25, x: 0, y: H * 0.03 },
              ...orbit,
              { time: 2.6, x: staffTopX - stellaX + H * 0.12, y: staffTopY - stellaY + H * 0.06 },
              { time: 3.05, x: staffTopX - stellaX + H * 0.14, y: staffTopY - stellaY + H * 0.05 },
              { time: 3.65, x: H * 0.3, y: 0 },
              { time: 4.35, x: 0, y: 0 },
              { time: duration, x: 0, y: 0 },
            ],
            rotate: [
              { time: 0, angle: 0 },
              { time: 0.45, angle: -15 },
              { time: 1.3, angle: 10 },
              { time: 2.35, angle: -5 },
              { time: 2.8, angle: 8 },
              { time: 3.65, angle: 0 },
              { time: duration, angle: 0 },
            ],
            scale: [
              { time: 0, x: 1, y: 1 },
              { time: 2.35, x: 1, y: 1 },
              { time: 2.8, x: 1.18, y: 1.18 },
              { time: 3.2, x: 1.05, y: 1.05 },
              { time: duration, x: 1, y: 1 },
            ],
          },
          // Sceptrul rămâne în mână; doar se ridică spre cer la sincronizare, apoi coboară.
          moonstaff: {
            rotate: [
              { time: 0, angle: 0 },
              { time: 1.7, angle: 10 },
              { time: 2.55, angle: -6 },
              { time: 3.1, angle: -14 },
              { time: duration, angle: 0 },
            ],
            scale: [
              { time: 0, x: 1, y: 1 },
              { time: 2.5, x: 1.12, y: 1.12 },
              { time: 3.2, x: 1.12, y: 1.12 },
              { time: duration, x: 1, y: 1 },
            ],
          },
          astralwave: {
            rotate: [
              { time: 0, angle: 0 },
              { time: duration, angle: 160 },
            ],
            scale: [
              { time: 0, x: 0.05, y: 0.05 },
              { time: 2.35, x: 0.1, y: 0.1 },
              { time: 2.75, x: 0.5, y: 0.5 },
              { time: 3.05, x: 2.2, y: 2.2 },
              { time: 3.6, x: 3.8, y: 3.8 },
              { time: 4.1, x: 4.7, y: 4.7 },
              { time: duration, x: 0.05, y: 0.05 },
            ],
          },
        },
        slots: {
          astralwave: {
            color: [
              { time: 0, color: 'a59dff00' },
              { time: 2.3, color: 'a59dff00' },
              { time: 2.7, color: 'ccb6ffcc' },
              { time: 3.05, color: 'dfeeffff' },
              { time: 3.6, color: 'ad96ff99' },
              { time: 4.1, color: 'ad96ff00' },
              { time: duration, color: 'a59dff00' },
            ],
          },
        },
      },
      'ult2',
    );
    // Corpul zboară pe loc (animația nativă de zbor, fără deplasarea rădăcinii), în buclă pe toată durata.
    const fly = originals.find((a) => a.name === 'fly') || originals.find((a) => a.name === 'breathe');
    const flyAnim = data.animations.find((a) => a.name === fly.name);
    const flightTimelines = flyAnim.timelines
      .filter((t) => !(t.boneIndex === 0 && (t instanceof s.TranslateTimeline || t instanceof s.RotateTimeline)))
      .map((t) => {
        const wrapped = Object.create(t);
        wrapped.apply = function (skeleton, lastTime, time, events, alpha, blend, direction) {
          return t.apply(skeleton, lastTime < 0 ? lastTime : lastTime % fly.duration, time % fly.duration, events, alpha, blend, direction);
        };
        return wrapped;
      });
    data.animations.push(new s.Animation('ult2', [...flightTimelines, ...ult.timelines], duration));

    // Scheletul și starea se refac pe datele noi.
    raw.skeleton = new s.Skeleton(data);
    if (raw.config.skin) raw.skeleton.setSkinByName(raw.config.skin);
    else if (!data.defaultSkin && data.skins.length) raw.skeleton.setSkin(data.skins[0]);
    raw.skeleton.setToSetupPose();
    const stateData = new s.AnimationStateData(data);
    stateData.defaultMix = raw.config.defaultMix;
    raw.animationState = new s.AnimationState(stateData);

    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      atlas.dispose();
    };
  };
}
