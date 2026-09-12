// Validate the files using the same FBX parser as the browser, without decoding textures.
import {readFileSync, readdirSync} from 'node:fs';
import {Texture, TextureLoader} from 'three';
import {FBXLoader} from 'three-stdlib';
globalThis.window = {URL};
TextureLoader.prototype.load = () => new Texture();
const core = ['hips','spine','head','leftarm','rightarm','leftupleg','rightupleg'];
const normalize = name => name.replace(/^mixamorig\d*:?/i, '').toLowerCase();
const report = {characters: 0, unsupportedVersion: 0, compatibleCharacters: 0, animations: 0, compatibleAnimations: 0, errors: []};
const loader = new FBXLoader();
// Loader warnings about discarded extra vertex weights aren't parse failures.
console.warn = () => {};
for (const category of (process.argv.includes('--characters') ? ['characters'] : ['characters','animations'])) {
  for (const name of readdirSync(`public/assets/library/${category}`).filter(name => name.endsWith('.fbx'))) {
    const data = readFileSync(`public/assets/library/${category}/${name}`);
    report[category]++;
    try {
      const root = loader.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
      const names = new Set();
      if (category === 'characters') root.traverse(bone => {if(bone.isBone) names.add(normalize(bone.name))});
      else for (const track of root.animations[0]?.tracks ?? []) names.add(normalize(track.name.split('.')[0]));
      if (core.every(name => names.has(name))) report[category === 'characters' ? 'compatibleCharacters' : 'compatibleAnimations']++;
      else report.errors.push(`${category}/${name}: missing core bones`);
      root.traverse(node => node.geometry?.dispose());
    } catch (error) {
      if (error.message.includes('FileVersion: 6100')) report.unsupportedVersion++;
      else report.errors.push(`${category}/${name}: ${error.message}`);
    }
  }
  console.log(JSON.stringify(report));
}
